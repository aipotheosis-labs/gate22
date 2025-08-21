import logging
from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from aci.common import utils
from aci.common.schemas.auth import ActAsInfo, JWTPayload
from aci.control_plane import config

http_bearer = HTTPBearer(auto_error=True, description="login to receive a JWT token")


class RequestContextWithoutAuth:
    def __init__(self, db_session: Session):
        self.db_session = db_session


class RequestContext:
    def __init__(
        self,
        db_session: Session,
        user_id: str,
        act_as: ActAsInfo | None,
    ):
        self.db_session = db_session
        self.user_id = user_id
        self.act_as = act_as


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
        logging.info(f"Decoded token: {decoded_token}")
        jwt_payload = JWTPayload(**decoded_token)
        return jwt_payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token invalid") from e


# TODO: add a dependency to check if the organization is active


def get_request_context_without_auth(
    db_session: Annotated[Session, Depends(yield_db_session)],
) -> RequestContextWithoutAuth:
    return RequestContextWithoutAuth(db_session=db_session)


def get_request_context(
    db_session: Annotated[Session, Depends(yield_db_session)],
    jwt_payload: Annotated[JWTPayload, Depends(get_jwt_payload)],
) -> RequestContext:
    """
    Returns a RequestContext object containing the DB session, user_id and act_as information.
    """

    return RequestContext(
        db_session=db_session,
        user_id=jwt_payload.user_id,
        act_as=jwt_payload.act_as,
    )
