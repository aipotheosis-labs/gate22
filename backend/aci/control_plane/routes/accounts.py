import datetime
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from aci.common.db import crud
from aci.common.db.sql_models import User
from aci.common.enums import UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.accounts import (
    LoginRequest,
    OrganizationMembershipInfo,
    RegistrationRequest,
    TokenResponse,
    UserInfo,
)
from aci.common.schemas.auth import ActAsInfo, JWTPayload
from aci.control_plane import config
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    context: Annotated[
        deps.RequestContextWithoutAuth, Depends(deps.get_request_context_without_auth)
    ],
    request: RegistrationRequest,
) -> UserInfo | None:
    if request.auth_flow == UserIdentityProvider.EMAIL:
        # Check if user already exists
        user = crud.accounts.get_user_by_email(context.db_session, request.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists"
            )

        # Hash password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(request.password.encode(), salt)

        # Create user
        user = crud.accounts.create_user(
            db_session=context.db_session,
            name=request.name,
            email=request.email,
            password_hash=hashed.decode(),
            identity_provider=request.auth_flow,
        )

        context.db_session.commit()

        return UserInfo(
            user_id=str(user.id),
            name=user.name,
            email=user.email,
            organizations=[
                OrganizationMembershipInfo(
                    organization_id=str(org_membership.organization_id),
                    organization_name=org_membership.organization.name,
                    role=org_membership.role,
                )
                for org_membership in user.organization_memberships
            ],
        )
    elif request.auth_flow == UserIdentityProvider.GOOGLE:
        # TODO: Implement Google registration
        return None


@router.post("/login", response_model=TokenResponse | None, status_code=status.HTTP_200_OK)
async def login(
    context: Annotated[
        deps.RequestContextWithoutAuth, Depends(deps.get_request_context_without_auth)
    ],
    request: LoginRequest,
) -> TokenResponse | None:
    if request.auth_flow == UserIdentityProvider.EMAIL:
        user = crud.accounts.get_user_by_email(context.db_session, request.email)

        # User not found
        if not user:
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

        # TODO: We should store the last used organization and role
        act_as = (
            ActAsInfo(
                organization_id=str(user.organization_memberships[0].organization_id),
                role=user.organization_memberships[0].role,
            )
            if len(user.organization_memberships) > 0
            else None
        )

        token = _sign_token(user, act_as)

        return TokenResponse(token=token)
    elif request.auth_flow == UserIdentityProvider.GOOGLE:
        # TODO: Implement Google login
        return None


def _sign_token(user: User, act_as: ActAsInfo | None) -> str:
    expired_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
        minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    jwt_payload = JWTPayload(
        sub=str(user.id),
        exp=int(expired_at.timestamp()),
        user_id=str(user.id),
        name=user.name,
        email=user.email,
        act_as=act_as,
    )
    # Sign JWT, with the user's acted as organization and role
    token = jwt.encode(
        jwt_payload.model_dump(), config.JWT_SIGNING_KEY, algorithm=config.JWT_ALGORITHM
    )
    return token


@router.post("/profile", response_model=UserInfo | None, status_code=status.HTTP_200_OK)
async def profile(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
) -> UserInfo | None:
    user = crud.accounts.get_user_by_id(context.db_session, context.user_id)

    # Should never happen as the user_id is validated in the JWT payload
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserInfo(
        user_id=str(user.id),
        name=user.name,
        email=user.email,
        organizations=[
            OrganizationMembershipInfo(
                organization_id=str(org_membership.organization_id),
                organization_name=org_membership.organization.name,
                role=org_membership.role,
            )
            for org_membership in user.organization_memberships
        ],
    )
