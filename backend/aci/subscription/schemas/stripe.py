from pydantic import BaseModel, ConfigDict


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
