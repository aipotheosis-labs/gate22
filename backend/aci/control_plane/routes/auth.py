import datetime
import hashlib
import hmac
import secrets
from typing import Annotated
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from uuid import UUID

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse

from aci.common.db import crud
from aci.common.db.sql_models import User
from aci.common.enums import OrganizationRole, UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import (
    ActAsInfo,
    AuthOperation,
    EmailLoginRequest,
    EmailRegistrationRequest,
    IssueTokenRequest,
    JWTPayload,
    OAuth2State,
    TokenResponse,
)
from aci.control_plane import config
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import OAuth2Error
from aci.control_plane.google_login_utils import (
    exchange_google_userinfo,
    generate_google_auth_url,
)

logger = get_logger(__name__)
router = APIRouter()


@router.get(
    "/{operation}/google/authorize",
    response_model=str,
    status_code=status.HTTP_200_OK,
    description="""
    This endpoint is expected to be directly access by browser instead of API call.
    It responds with a 302 redirect to Google OAuth2 authorization page.
    """,
)
async def get_google_oauth2_url(
    operation: AuthOperation,
    redirect_uri: str = Query(
        default=config.FRONTEND_URL,
        description="The redirect URI to redirect to after the OAuth2 flow (e.g. `/dashboard`)",
    ),
) -> RedirectResponse:
    return RedirectResponse(
        url=await generate_google_auth_url(
            AuthOperation(operation), post_oauth_redirect_uri=redirect_uri
        ),
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
    "/{operation}/google/callback",
    status_code=status.HTTP_200_OK,
    description="""
    This endpoint is expected to be used in oauth flow as redirect URI.
    It listens to the code and state parameters from Google OAuth2 authorization page.
    It will redirect to the "redirect_uri" that is passed when calling the "authorize" endpoint.
    """,
)
async def google_callback(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    operation: AuthOperation,
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

    google_userinfo = await exchange_google_userinfo(operation, code, oauth_info)

    if operation == AuthOperation.REGISTER:
        # Check if email already been used
        user = crud.users.get_user_by_email(db_session, google_userinfo.email)
        if user:
            return RedirectResponse(
                _construct_error_url(oauth_info.post_oauth_redirect_uri, "user_already_exists"),
                status_code=status.HTTP_302_FOUND,
            )

        # Create user
        user = crud.users.create_user(
            db_session=db_session,
            name=google_userinfo.name,
            email=google_userinfo.email,
            password_hash=None,
            identity_provider=UserIdentityProvider.GOOGLE,
        )

    elif operation == AuthOperation.LOGIN:
        user = crud.users.get_user_by_email(db_session, google_userinfo.email)

        # User not found or deleted
        if not user or user.deleted_at:
            return RedirectResponse(
                _construct_error_url(oauth_info.post_oauth_redirect_uri, "user_not_found"),
                status_code=status.HTTP_302_FOUND,
            )

    else:
        raise OAuth2Error(message="Invalid operation parameter during OAuth2 flow")

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
    token in the response cookie. Call /token endpoint to get a JWT token.
    """,
)
async def register(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    request: EmailRegistrationRequest,
    response: Response,
) -> None:
    # Check if user already exists
    user = crud.users.get_user_by_email(db_session, request.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already been used"
        )

    # Hash password
    hashed = _hash_user_password(request.password)

    # Create user
    user = crud.users.create_user(
        db_session=db_session,
        name=request.name,
        email=request.email,
        password_hash=hashed,
        identity_provider=UserIdentityProvider.EMAIL,
    )

    db_session.commit()

    # Issue a refresh token, store in secure cookie
    _issue_refresh_token(db_session, user.id, response)


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

    # User not found or deleted
    if not user or user.deleted_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    # Password not set or doesn't match
    if not user.password_hash or not bcrypt.checkpw(
        request.password.encode(), user.password_hash.encode()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
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
    logger.info(f"Refresh token: {refresh_token}")

    # Check if refresh token is valid
    refresh_token_hash = _hash_refresh_token(refresh_token)
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
    token = _sign_token(user, act_as)

    return TokenResponse(token=token)


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
        token_hash = _hash_refresh_token(refresh_token)
        crud.users.delete_refresh_token(db_session, token_hash)

    # Delete the refresh token in cookie
    response.delete_cookie("refresh_token")


def _hash_refresh_token(refresh_token: str) -> str:
    """
    Hash a refresh token. Using HMAC-SHA-256 is good enough for hashing refresh token.
    """
    return hmac.new(
        config.REFRESH_TOKEN_KEY.encode(), refresh_token.encode(), hashlib.sha256
    ).hexdigest()


def _issue_refresh_token(db_session: Session, user_id: UUID, response: Response) -> None:
    """
    Generate a refresh token, store it in the database and set it in response cookie.
    """

    # Generate a refresh token
    refresh_token = secrets.token_urlsafe(32)

    # Hash refresh token
    token_hash = _hash_refresh_token(refresh_token)

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


def _hash_user_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt)
    return hashed.decode()


def _sign_token(user: User, act_as: ActAsInfo | None) -> str:
    """
    Sign a JWT token for the user. It should include act_as information.
    """
    now = datetime.datetime.now(datetime.UTC)
    expired_at = now + datetime.timedelta(minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    jwt_payload = JWTPayload(
        sub=str(user.id),
        exp=int(expired_at.timestamp()),
        iat=int(now.timestamp()),
        user_id=user.id,
        name=user.name,
        email=user.email,
        act_as=act_as,
    )
    # Sign JWT, with the user's acted as organization and role
    token = jwt.encode(
        jwt_payload.model_dump(mode="json"), config.JWT_SIGNING_KEY, algorithm=config.JWT_ALGORITHM
    )
    return token
