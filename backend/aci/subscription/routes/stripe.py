from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from aci.common.logging_setup import get_logger
from aci.subscription import dependencies as deps
from aci.subscription.schemas.stripe import StripeWebhookEvent

logger = get_logger(__name__)
router = APIRouter()


EVENT_TYPES = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
]


@router.post(
    "webhook",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
async def stripe_webhook(
    db_session: Annotated[Session, Depends(deps.yield_db_session)], body: StripeWebhookEvent
) -> None:
    match body.type:
        case "customer.subscription.created":
            # subscription = body.data.object
            pass
        case "customer.subscription.updated":
            pass
        case "customer.subscription.deleted":
            pass

    return None
