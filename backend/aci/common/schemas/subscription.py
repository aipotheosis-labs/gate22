from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SubscriptionPlanCreate(BaseModel):
    plan_code: str
    display_name: str
    is_free: bool
    is_public: bool
    stripe_price_id: str | None
    min_seats_for_subscription: int | None
    max_seats_for_subscription: int | None
    max_custom_mcp_servers: int | None
    log_retention_days: int | None


class Entitlement(BaseModel):
    seat_count: int
    max_custom_mcp_servers: int
    log_retention_days: int


class SubscriptionPublic(BaseModel):
    plan_code: str
    seat_count: int
    stripe_subscription_status: Literal["active", "trialing", "past_due"]
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool


class SubscriptionStatusPublic(BaseModel):
    subscription: SubscriptionPublic | None
    entitlement: Entitlement


class SubscriptionRequest(BaseModel):
    plan_code: str
    seat_count: int | None = None


class SubscriptionCheckout(BaseModel):
    url: str


class SubscriptionResult(BaseModel):
    subscription_id: str


class SubscriptionCancellation(BaseModel):
    subscription_id: str


class OrganizationSubscriptionUpsert(BaseModel):
    plan_code: str
    seat_count: int
    # See https://docs.stripe.com/billing/subscriptions/overview?locale=en-GB
    stripe_subscription_status: Literal[
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete_expired",
        "incomplete",
        "paused",
        "unpaid",
    ]
    stripe_subscription_id: str
    stripe_subscription_item_id: str
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    subscription_start_date: datetime


##############################
# Stripe Event Data
#############################
class StripeEventData(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str  # subscription id
    status: str


class StripeEventDataObject(BaseModel):
    model_config = ConfigDict(extra="allow")
    object: StripeEventData


class StripeWebhookEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str  # event id
    type: str
    data: StripeEventDataObject


class StripeVerifySessionRequest(BaseModel):
    session_id: str
