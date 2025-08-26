from collections.abc import Generator
from typing import Annotated, Literal, overload
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from aci.common import utils
from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.schemas.auth import ActAsInfo, JWTPayload
from aci.control_plane import config

http_bearer = HTTPBearer(auto_error=True, description="login to receive a JWT token")


class RequestContextWithoutActAs(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    db_session: Session
    user_id: UUID


class RequestContext(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    db_session: Session
    user_id: UUID
    act_as: ActAsInfo


def yield_db_session() -> Generator[Session, None, None]:
    db_session = utils.create_db_session(config.DB_FULL_URL)
    try:
        yield db_session
    finally:
        db_session.close()


def get_jwt_payload(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(http_bearer)],
) -> JWTPayload:
    try:
        decoded_token = jwt.decode(
            credentials.credentials, config.JWT_SIGNING_KEY, algorithms=[config.JWT_ALGORITHM]
        )
        jwt_payload = JWTPayload(**decoded_token)
        return jwt_payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token invalid") from e


@overload
def get_request_context(
    db_session: Annotated[Session, Depends(yield_db_session)],
    jwt_payload: Annotated[JWTPayload, Depends(get_jwt_payload)],
    is_act_as_required: Literal[False],
) -> RequestContextWithoutActAs: ...


@overload
def get_request_context(
    db_session: Annotated[Session, Depends(yield_db_session)],
    jwt_payload: Annotated[JWTPayload, Depends(get_jwt_payload)],
    is_act_as_required: Literal[True],
) -> RequestContext: ...


def get_request_context(
    db_session: Annotated[Session, Depends(yield_db_session)],
    jwt_payload: Annotated[JWTPayload, Depends(get_jwt_payload)],
    is_act_as_required: bool = True,
) -> RequestContext | RequestContextWithoutActAs:
    """
    This method validates whether the user is permitted to act as the desired organization and role.
    Returns a RequestContext object containing the DB session, user_id and act_as information.
    """
    if jwt_payload.act_as:
        # Check if organization exists
        if jwt_payload.act_as.organization_id:
            organization = crud.organizations.get_organization_by_id(
                db_session, jwt_payload.act_as.organization_id
            )
            if not organization:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        # Check if user is a member of the organization
        membership = crud.organizations.get_organization_membership(
            db_session, jwt_payload.act_as.organization_id, jwt_payload.user_id
        )
        if not membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

        # Check if user has the required role in the organization
        if not is_role_valid(jwt_payload.act_as.role, membership.role):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    else:
        if is_act_as_required:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        else:
            return RequestContextWithoutActAs(
                db_session=db_session,
                user_id=jwt_payload.user_id,
            )

    return RequestContext(
        db_session=db_session,
        user_id=jwt_payload.user_id,
        act_as=jwt_payload.act_as,
    )


# TODO: Improve this function when we have more roles
def is_role_valid(act_as_role: OrganizationRole, membership_role: OrganizationRole) -> bool:
    # Admin can act as any role
    if membership_role == OrganizationRole.ADMIN:
        return True
    # Member can only act as member
    if membership_role == OrganizationRole.MEMBER:
        return act_as_role == OrganizationRole.MEMBER
