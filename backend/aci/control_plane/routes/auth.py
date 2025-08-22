import datetime
import secrets
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status

from aci.common.db import crud
from aci.common.db.sql_models import User
from aci.common.enums import UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import (
    ActAsInfo,
    JWTPayload,
    LoginRequest,
    OAuth2AuthUrlResponse,
    RegistrationRequest,
    TokenResponse,
)
from aci.control_plane import config
from aci.control_plane import dependencies as deps
from aci.control_plane.google_login_utils import exchange_google_userinfo, generate_google_auth_url

logger = get_logger(__name__)
router = APIRouter()


@router.get("/oauth2/google/auth-url")
async def get_google_auth_url() -> OAuth2AuthUrlResponse:
    auth_url = await generate_google_auth_url()
    return OAuth2AuthUrlResponse(auth_url=auth_url)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    context: Annotated[
        deps.RequestContextWithoutAuth, Depends(deps.get_request_context_without_auth)
    ],
    request: RegistrationRequest,
    response: Response,
) -> TokenResponse | None:
    if request.auth_flow == UserIdentityProvider.EMAIL:
        # Check if user already exists
        user = crud.users.get_user_by_email(context.db_session, request.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already been used"
            )

        # Hash password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(request.password.encode(), salt)

        # Create user
        user = crud.users.create_user(
            db_session=context.db_session,
            name=request.name,
            email=request.email,
            password_hash=hashed.decode(),
            identity_provider=UserIdentityProvider.EMAIL,
        )

    elif request.auth_flow == UserIdentityProvider.GOOGLE:
        google_userinfo = await exchange_google_userinfo(request.code, request.state)

        # Check if email already been used
        user = crud.users.get_user_by_email(context.db_session, google_userinfo.email)

        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already been used"
            )

        # Create user
        user = crud.users.create_user(
            db_session=context.db_session,
            name=google_userinfo.name,
            email=google_userinfo.email,
            password_hash=None,
            identity_provider=UserIdentityProvider.GOOGLE,
        )

    context.db_session.commit()

    # Issue a JWT Token
    token = _sign_token(user, None)

    # Issue a refresh token, store in secure cookie
    refresh_token = secrets.token_urlsafe(32)
    _set_refresh_token(response, refresh_token)

    return TokenResponse(token=token)


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    context: Annotated[
        deps.RequestContextWithoutAuth, Depends(deps.get_request_context_without_auth)
    ],
    request: LoginRequest,
    response: Response,
) -> TokenResponse | None:
    if request.auth_flow == UserIdentityProvider.EMAIL:
        user = crud.users.get_user_by_email(context.db_session, request.email)

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

    elif request.auth_flow == UserIdentityProvider.GOOGLE:
        google_userinfo = await exchange_google_userinfo(request.code, request.state)

        user = crud.users.get_user_by_email(context.db_session, google_userinfo.email)

        # User not found or deleted
        if not user or user.deleted_at:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not exists")

    # Update the last login time
    user.last_login_at = datetime.datetime.now(datetime.UTC)
    context.db_session.commit()

    # Issue a JWT Token
    # TODO: We should store the last used organization and role
    act_as = (
        ActAsInfo(
            organization_id=user.organization_memberships[0].organization_id,
            role=user.organization_memberships[0].role,
        )
        if len(user.organization_memberships) > 0
        else None
    )
    token = _sign_token(user, act_as)

    # Issue a refresh token, store in secure cookie
    refresh_token = secrets.token_urlsafe(32)
    _set_refresh_token(response, refresh_token)

    return TokenResponse(token=token)


def _set_refresh_token(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/auth/refresh",
    )


def _sign_token(user: User, act_as: ActAsInfo | None) -> str:
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


# TODO: Token endpoint
# @router.post("/token", response_model=TokenResponse | None, status_code=status.HTTP_200_OK)
# async def issue_token(
#     context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
#     request: IssueTokenRequest,
#     raw_request: Request
# ) -> TokenResponse | None:

#     act_as = context.act_as

#     user = crud.users.get_user_by_id(context.db_session, context.user_id)
#     if not user:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

#     refresh_token = raw_request.cookies.get("refresh_token")


#     elif request.operation == "update_act_as":
#         act_as = context.act_as or ActAsInfo(
#             organization_id=request.organization_id,
#             role=request.role,
#         )

#     token = _sign_token(user, act_as)

#     return None
