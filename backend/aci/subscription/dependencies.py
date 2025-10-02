from collections.abc import Generator

from sqlalchemy.orm import Session
from stripe import StripeClient

from aci.common import utils
from aci.common.logging_setup import get_logger
from aci.subscription import config

logger = get_logger(__name__)


def yield_db_session() -> Generator[Session, None, None]:
    db_session = utils.create_db_session(config.DB_FULL_URL)
    try:
        yield db_session
    finally:
        db_session.close()


def get_stripe_client() -> StripeClient:
    return StripeClient(config.STRIPE_SECRET_KEY)
