from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from aci.common import utils
from aci.control_plane import config


class RequestContext:
    def __init__(self, db_session: Session):
        self.db_session = db_session


def yield_db_session() -> Generator[Session, None, None]:
    db_session = utils.create_db_session(config.DB_FULL_URL)
    try:
        yield db_session
    finally:
        db_session.close()


def get_request_context(
    db_session: Annotated[Session, Depends(yield_db_session)],
) -> RequestContext:
    """
    Returns a RequestContext object containing the DB session.
    """
    return RequestContext(db_session=db_session)
