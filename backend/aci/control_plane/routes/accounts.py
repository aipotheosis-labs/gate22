import datetime
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import config

from aci.common.db.crud.accounts import create_user, get_user_by_email
from aci.common.enums import UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.accounts import LoginRequest, LoginResponse, RegistrationRequest
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    request: RegistrationRequest,
) -> None:
    if request.auth_flow == UserIdentityProvider.EMAIL:
        # Hash password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(request.password.encode(), salt)

        # Create user
        create_user(
            db_session=context.db_session,
            name=request.name,
            email=request.email,
            password_hash=hashed.decode(),
            identity_provider=request.auth_flow,
        )


@router.post("/login", response_model=LoginResponse | None, status_code=status.HTTP_200_OK)
async def login(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    request: LoginRequest,
) -> LoginResponse | None:
    if request.auth_flow == UserIdentityProvider.EMAIL:
        user = get_user_by_email(context.db_session, request.email)

        # User not found
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        # Password not set or doesn't match
        if not user.password_hash or not bcrypt.checkpw(
            request.password.encode(), user.password_hash.encode()
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        # Sign JWT
        token = jwt.encode(
            {
                "sub": user.id,
                "exp": datetime.datetime.utcnow()
                + datetime.timedelta(minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
                "user_id": user.id,
                "email": user.email,
                "name": user.name,
                "organizations": [
                    {
                        "organization_id": org_membership.organization_id,
                        "organization_name": org_membership.organization.name,
                        "role": org_membership.role,
                    }
                    for org_membership in user.organization_memberships
                ],
                # TODO: memorize the last organization the user acted as
                "current_act_as": {
                    "organization_id": user.organization_memberships[0].organization_id,
                    "role": user.organization_memberships[0].role,
                },
            },
            config.JWT_SIGNING_KEY,
            algorithm=config.JWT_ALGORITHM,
        )

        return LoginResponse(token=token)
    return None
