from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, HttpUrl


class OrganizationSubscriptionStatus(StrEnum):
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
    status: OrganizationSubscriptionStatus
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
