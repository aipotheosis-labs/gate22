import datetime
from typing import Annotated, Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from uuid import UUID

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import User, Verification
from aci.common.enums import OrganizationRole, UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import (
    ActAsInfo,
    EmailLoginRequest,
    EmailRegistrationRequest,
    IssueTokenRequest,
    OAuth2State,
    TokenResponse,
)
from aci.control_plane import config
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import OAuth2Error
from aci.control_plane.external_services.email_service import email_service
from aci.control_plane.utils import token as token_utils
from aci.control_plane.utils.google_oauth import (
    exchange_google_userinfo,
    generate_google_auth_url,
)

logger = get_logger(__name__)
router = APIRouter()


@router.get(
    "/google/authorize",
    response_model=str,
    status_code=status.HTTP_200_OK,
    description="""
    This endpoint is expected to be directly access by browser instead of API call.
    It responds with a 302 redirect to Google OAuth2 authorization page.
    """,
)
async def get_google_oauth2_url(
    redirect_uri: str = Query(
        default=config.FRONTEND_URL,
        description="The redirect URI to redirect to after the OAuth2 flow (e.g. `/dashboard`)",
    ),
) -> RedirectResponse:
    return RedirectResponse(
        url=await generate_google_auth_url(post_oauth_redirect_uri=redirect_uri),
        status_code=status.HTTP_302_FOUND,
    )


def _construct_error_url(post_oauth_redirect_uri: str, error_msg: str) -> str:
    """
    Construct an error URL with the given redirect URI and error message.
    """
    parsed = urlparse(post_oauth_redirect_uri)
    query_params = parse_qs(parsed.query)
    query_params["error"] = [error_msg]

    new_query = urlencode(query_params, doseq=True)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment)
    )


@router.get(
    "/google/callback",
    status_code=status.HTTP_200_OK,
    description="""
    This endpoint is expected to be used in oauth flow as redirect URI.
    It listens to the code and state parameters from Google OAuth2 authorization page.
    It will redirect to the "redirect_uri" that is passed when calling the "authorize" endpoint.
    """,
)
async def google_callback(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    error: str | None = None,
    code: str | None = None,
    state: str | None = None,
) -> RedirectResponse:
    # Check if error
    if error:
        raise OAuth2Error(message="Error during OAuth2 flow")

    if not code:
        raise OAuth2Error(message="Missing code parameter during OAuth2 flow")
    if not state:
        raise OAuth2Error(message="Missing state parameter during OAuth2 flow")

    # Parse the state JWT
    state_jwt = jwt.decode(state, config.JWT_SIGNING_KEY, algorithms=[config.JWT_ALGORITHM])
    try:
        oauth_info = OAuth2State(**state_jwt)
    except ValidationError as e:
        raise OAuth2Error(message="Invalid state parameter during OAuth2 flow") from e

    google_userinfo = await exchange_google_userinfo(code, oauth_info)

    # Get user by email (now includes deleted users)
    user = crud.users.get_user_by_email(db_session, google_userinfo.email)

    # Handle existing users
    if user:
        if user.deleted_at is not None:
            # Redirect with error for soft-deleted account
            error_msg = (
                "This account is under deletion process. "
                "Please contact support if you need assistance."
            )
            error_url = _construct_error_url(
                oauth_info.post_oauth_redirect_uri,
                error_msg,
            )
            return RedirectResponse(error_url, status_code=status.HTTP_302_FOUND)
    else:
        # Create new user if doesn't exist
        user = crud.users.create_user(
            db_session=db_session,
            name=google_userinfo.name,
            email=google_userinfo.email,
            password_hash=None,
            identity_provider=UserIdentityProvider.GOOGLE,
            email_verified=True,
        )

    # Issue a refresh token, store in secure cookie
    response = RedirectResponse(
        oauth_info.post_oauth_redirect_uri, status_code=status.HTTP_302_FOUND
    )
    _issue_refresh_token(db_session, user.id, response)

    return response


@router.post(
    "/register/email",
    status_code=status.HTTP_201_CREATED,
    description="""
    Register a new user using email flow. On success, it will set a refresh
    token in the response cookie and send a verification email.
    Call /token endpoint to get a JWT token.
    """,
)
async def register(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    request: EmailRegistrationRequest,
    response: Response,
) -> None:
    try:
        # Use helper function to handle registration and email verification
        user, _ = await _register_user_with_email(
            db_session=db_session,
            name=request.name,
            email=request.email,
            password=request.password,
        )

        db_session.commit()

        # Issue a refresh token, store in secure cookie
        _issue_refresh_token(db_session, user.id, response)

    except ValueError as e:
        # Handle business logic errors
        error_msg = str(e)
        if "deletion process" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=error_msg,
            ) from e
        elif "Email already been used" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            ) from e
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            ) from e


@router.post(
    "/login/email",
    status_code=status.HTTP_200_OK,
    description="""
    Login a user using email flow. On success, it will set a refresh token in the response cookie.
    Call /token endpoint to get a JWT token.
    """,
)
async def login(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    request: EmailLoginRequest,
    response: Response,
) -> None:
    user = crud.users.get_user_by_email(db_session, request.email)

    # User not found
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    # Check if account is deleted
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This account is under deletion process. "
                "Please contact support if you need assistance."
            ),
        )

    # Password not set or doesn't match
    if not user.password_hash or not bcrypt.checkpw(
        request.password.encode(), user.password_hash.encode()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    # Require email verification for email/password logins
    if not user.email_verified and user.identity_provider == UserIdentityProvider.EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox for the verification link.",
        )

    # Update the last login time
    user.last_login_at = datetime.datetime.now(datetime.UTC)
    db_session.commit()

    # Issue a refresh token, store in secure cookie
    _issue_refresh_token(db_session, user.id, response)


@router.post(
    "/token",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    description="""
    Issue a JWT token for the user. It will get refresh token from secure cookies. Pass act_as
    whenever possible to make sure user is acting as a specific organization and role.
    """,
)
async def issue_token(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    request: Request,
    input: IssueTokenRequest,
) -> TokenResponse:
    # Get the refresh token from the request cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token"
        )

    # Check if refresh token is valid
    refresh_token_hash = token_utils.hash_refresh_token(refresh_token)
    refresh_token_obj = crud.users.get_refresh_token(db_session, refresh_token_hash)
    if not refresh_token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Get the user from the database
    user = crud.users.get_user_by_id(db_session, refresh_token_obj.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    act_as: ActAsInfo | None
    if input.act_as:
        # Check if user is a member of the requested organization
        membership = crud.organizations.get_organization_membership(
            db_session, input.act_as.organization_id, user.id
        )
        if not membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

        # TODO: make a global function for role comparisons
        # If user is acting as admin, make sure the user is an admin in the organization
        if (
            input.act_as.role == OrganizationRole.ADMIN
            and membership.role != OrganizationRole.ADMIN
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

        # Assign the act_as variable when it's provided
        act_as = input.act_as

    else:
        # If no act_as is provided, use anyone organization and role
        # TODO: We should store the last used organization and role
        act_as = (
            ActAsInfo(
                organization_id=user.organization_memberships[0].organization_id,
                role=user.organization_memberships[0].role,
            )
            if len(user.organization_memberships) > 0
            else None
        )

    # Issue a JWT Token
    token = utils.sign_token(
        user=user,
        act_as=act_as,
        jwt_signing_key=config.JWT_SIGNING_KEY,
        jwt_algorithm=config.JWT_ALGORITHM,
        jwt_access_token_expire_minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    return TokenResponse(token=token)


@router.get(
    "/verify-email",
    status_code=status.HTTP_302_FOUND,
    description="""
    Verify a user's email address using the token from the verification email.
    Redirects to the frontend with success or error status.
    """,
)
async def verify_email(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    token: str = Query(..., description="The verification token from the email"),
) -> RedirectResponse:
    # Use helper function to verify email
    is_valid, message, _ = _verify_user_email(db_session, token)

    if not is_valid:
        # Redirect to frontend with error
        error_url = f"{config.FRONTEND_URL}/auth/verify-error?error={message}"
        return RedirectResponse(error_url, status_code=status.HTTP_302_FOUND)

    # Commit the transaction
    db_session.commit()

    # Redirect to frontend with success
    success_url = f"{config.FRONTEND_URL}/auth/verify-success"
    return RedirectResponse(success_url, status_code=status.HTTP_302_FOUND)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    description="""
    Logout a user. It will clear the refresh token in the response cookie.
    """,
)
async def logout(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    request: Request,
    response: Response,
) -> None:
    # Get the refresh token from the request cookie
    refresh_token = request.cookies.get("refresh_token")

    # Delete the refresh token in database
    if refresh_token:
        token_hash = token_utils.hash_refresh_token(refresh_token)
        crud.users.delete_refresh_token(db_session, token_hash)

    # Delete the refresh token in cookie
    response.delete_cookie("refresh_token")


def _issue_refresh_token(db_session: Session, user_id: UUID, response: Response) -> None:
    """
    Generate a refresh token, store it in the database and set it in response cookie.
    """

    # Generate a refresh token and its hash
    refresh_token, token_hash = token_utils.generate_refresh_token()

    # Set the refresh token expiration time
    expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)

    # Create refresh token in database
    crud.users.create_refresh_token(db_session, user_id, token_hash, expires_at)

    db_session.commit()

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )


async def _register_user_with_email(
    db_session: Session,
    name: str,
    email: str,
    password: str,
) -> tuple[User, dict[str, Any] | None]:
    """
    Register a new user with email and send verification email.
    Returns the created user and email metadata.
    """
    # Check if user already exists
    existing_user = crud.users.get_user_by_email(db_session, email)
    if existing_user:
        if existing_user.deleted_at is not None:
            raise ValueError(
                "This account is under deletion process. "
                "Please contact support if you need assistance."
            )

        # If the existing account is a third-party identity, do not allow overriding
        if existing_user.identity_provider != UserIdentityProvider.EMAIL:
            raise ValueError(
                "This email is already registered with a third-party login. Please sign in with that provider."
            )

        # If the email is already verified, treat as an existing account
        if existing_user.email_verified:
            raise ValueError("Email already been used")

        # For unverified existing email accounts, update latest info and resend verification
        existing_user.name = name
        existing_user.password_hash = utils.hash_user_password(password)
        db_session.add(existing_user)

        # Invalidate any previous unused verification tokens for this user
        now_ts = datetime.datetime.now(datetime.UTC)
        (
            db_session.query(Verification)
            .filter(
                Verification.user_id == existing_user.id,
                Verification.type == "email_verification",
                Verification.used_at.is_(None),
            )
            .update({Verification.used_at: now_ts}, synchronize_session=False)
        )

        user = existing_user
    else:
        # Create user with email_verified=false
        password_hash = utils.hash_user_password(password)
        user = crud.users.create_user(
            db_session=db_session,
            name=name,
            email=email,
            password_hash=password_hash,
            identity_provider=UserIdentityProvider.EMAIL,
        )

    # Generate and send verification email
    token, token_hash, expires_at = token_utils.generate_verification_token(
        user_id=user.id,
        email=email,
        verification_type="email_verification",
    )

    # Create verification URL
    base_url = f"{config.CONTROL_PLANE_BASE_URL}{config.APP_ROOT_PATH}"
    verification_url = f"{base_url}/auth/verify-email?token={token}"

    # Send verification email
    email_metadata = await email_service.send_verification_email(
        recipient=email,
        user_name=name,
        verification_url=verification_url,
    )

    # Store verification record
    verification = Verification(
        user_id=user.id,
        type="email_verification",
        token_hash=token_hash,
        expires_at=expires_at,
        email_metadata=email_metadata,
    )
    db_session.add(verification)

    return user, email_metadata


def _verify_user_email(
    db_session: Session,
    token: str,
) -> tuple[bool, str, User | None]:
    """
    Verify a user's email using the verification token.
    Returns success status, message, and the user if successful.
    """
    # Validate and decode token
    payload = token_utils.validate_token(token)
    if not payload:
        # JWT invalid or expired
        return False, "invalid_or_expired_token", None

    if payload.get("type") != "email_verification":
        return False, "invalid_token_type", None

    # Check verification record
    token_hash = token_utils.hash_token(token)
    verification = (
        db_session.query(Verification)
        .filter(
            Verification.token_hash == token_hash,
            Verification.used_at.is_(None),
        )
        .first()
    )

    if not verification:
        return False, "token_not_found_or_already_used", None

    if verification.expires_at < datetime.datetime.now(datetime.UTC):
        return False, "token_expired", None

    user_id = UUID(payload["user_id"])
    if verification.user_id != user_id:
        return False, "token_mismatch", None

    # Mark verification as used
    verification.used_at = datetime.datetime.now(datetime.UTC)
    db_session.add(verification)

    # Update user's email_verified status
    user = crud.users.get_user_by_id(db_session, user_id)
    if user:
        user.email_verified = True
        db_session.add(user)
        db_session.commit()
        return True, "email_verified", user
    return False, "user_not_found", None
