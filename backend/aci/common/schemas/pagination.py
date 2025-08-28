from typing import TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    offset: int = Field(default=0, ge=0, description="Offset for pagination")
    limit: int = Field(
        default=30, ge=1, le=100, description="Limit for pagination, max 100, default 30"
    )


class PaginationResponse[T](BaseModel):
    data: list[T]
    offset: int
