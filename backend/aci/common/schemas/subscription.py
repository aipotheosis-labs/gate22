from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, EmailStr, HttpUrl


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


FREE_PLAN_CODE = "FREE_PLAN"


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
    billing_email: EmailStr
    plan_code: str
    seat_count: int
    success_url: HttpUrl
    cancel_url: HttpUrl


class SubscriptionCheckout(BaseModel):
    url: str


class SubscriptionCancelResult(BaseModel):
    pass


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
    subsription_start_date: int | None


class StripeEventDataObject(BaseModel):
    model_config = ConfigDict(extra="allow")

    object: StripeEventData


class StripeWebhookEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str
    data: StripeEventDataObject
