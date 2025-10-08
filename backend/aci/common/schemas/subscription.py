from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationInfo, field_validator, model_validator


class SubscriptionPlanPublic(BaseModel):
    plan_code: str
    display_name: str
    min_seats_for_subscription: int | None
    max_seats_for_subscription: int | None
    max_custom_mcp_servers: int | None
    log_retention_days: int | None


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

    @field_validator(
        "min_seats_for_subscription",
        "max_seats_for_subscription",
        "max_custom_mcp_servers",
        "log_retention_days",
    )
    @classmethod
    def validate_positive_integers(cls, v: int | None, info: ValidationInfo) -> int | None:
        if v is not None and v < 1:
            raise ValueError(f"{info.field_name} must be greater than 0")
        return v

    @model_validator(mode="after")
    def validate_min_max_seats(self) -> "SubscriptionPlanCreate":
        min_seats = self.min_seats_for_subscription
        max_seats = self.max_seats_for_subscription

        if min_seats is not None and max_seats is not None and min_seats > max_seats:
            raise ValueError("min_seats_for_subscription must be <= max_seats_for_subscription")

        return self


class Entitlement(BaseModel):
    seat_count: int | None
    max_custom_mcp_servers: int | None
    log_retention_days: int | None


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
