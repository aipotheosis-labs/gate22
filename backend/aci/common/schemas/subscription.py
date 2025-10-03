from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, HttpUrl

from aci.common.schemas.unset_aware_base_model import UndefinedAwareBaseModel


class SubscriptionPlanCreate(BaseModel):
    plan_code: str
    display_name: str
    is_public: bool
    stripe_price_id: str | None
    min_seats_for_subscription: int | None
    max_seats_for_subscription: int | None
    config_max_custom_mcp_servers: int | None
    config_log_retention_days: int | None


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


FREE_PLAN_CODE = "GATE22_FREE_PLAN"


class Entitlement(BaseModel):
    seat_count: int
    max_custom_mcp_servers: int
    log_retention_days: int


class SubscriptionPublic(BaseModel):
    plan_code: str
    status: SubscriptionStatus
    seat_count: int
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancel_at_period_end: bool
    cancelled_at: datetime | None


class SubscriptionStatusPublic(BaseModel):
    subscription: SubscriptionPublic
    entitlement: Entitlement


class SubscriptionRequest(BaseModel):
    plan_code: str
    seat_count: int | None
    success_url: HttpUrl
    cancel_url: HttpUrl


class SubscriptionCheckout(BaseModel):
    url: str


class SubscriptionCancelResult(BaseModel):
    pass


class OrganizationSubscriptionUpsert(UndefinedAwareBaseModel):
    _non_nullable_fields = [
        "plan_code",
        "seat_count",
        "status",
        "cancel_at_period_end",
    ]

    plan_code: str | None = None
    seat_count: int | None = None
    status: SubscriptionStatus | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool | None = None
    cancelled_at: datetime | None = None
    subscription_start_date: datetime | None = None
    stripe_subscription_id: str | None = None


class StripeEventData(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    object: str

    cancel_at_period_end: bool
    canceled_at: int | None

    current_period_end: int
    current_period_start: int

    quantity: int
    status: str
    subscription_start_date: int | None


class StripeEventDataObject(BaseModel):
    model_config = ConfigDict(extra="allow")

    object: StripeEventData


class StripeWebhookEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str
    data: StripeEventDataObject
