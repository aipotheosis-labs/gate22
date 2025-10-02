from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column, relationship

from aci.subscription.schemas.organization_subscription import OrganizationSubscriptionStatus

MAX_STRING_LENGTH = 512
MAX_ENUM_LENGTH = 50


class Base(MappedAsDataclass, DeclarativeBase):
    pass


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, init=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        init=False,
    )

    # One organization can have only one subscription
    subscription: Mapped[OrganizationSubscription | None] = relationship(
        back_populates="organization", init=False
    )
    entitlement_overrides: Mapped[OrganizationEntitlementOverride | None] = relationship(
        back_populates="organization", init=False
    )


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    plan_code: Mapped[str] = mapped_column(
        String(MAX_STRING_LENGTH), primary_key=True, unique=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False)
    stripe_price_id: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    min_seats_for_subscription: Mapped[int] = mapped_column(Integer, nullable=False)
    max_seats_for_subscription: Mapped[int] = mapped_column(Integer, nullable=False)
    config_max_custom_mcp_servers: Mapped[int] = mapped_column(Integer, nullable=False)
    config_log_retention_days: Mapped[int] = mapped_column(Integer, nullable=False)
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, init=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, init=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        init=False,
    )
    subscriptions: Mapped[list[OrganizationSubscription]] = relationship(
        back_populates="plan", init=False
    )


class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    plan_code: Mapped[str] = mapped_column(
        String(MAX_STRING_LENGTH), ForeignKey("subscription_plans.plan_code"), nullable=False
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(MAX_STRING_LENGTH), nullable=True
    )
    stripe_item_id: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    stripe_price_id: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    seat_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[OrganizationSubscriptionStatus] = mapped_column(
        SQLEnum(OrganizationSubscriptionStatus, native_enum=False, length=MAX_ENUM_LENGTH),
        nullable=False,
    )
    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, init=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        init=False,
    )

    organization: Mapped[Organization] = relationship(back_populates="subscription", init=False)
    plan: Mapped[SubscriptionPlan] = relationship(back_populates="subscriptions", init=False)

    # One organization can have only one subscription
    __table_args__ = (
        UniqueConstraint("organization_id", name="uc_org_plan"),
        UniqueConstraint("stripe_subscription_id", name="uc_stripe_subscription_id"),
    )


class OrganizationEntitlementOverride(Base):
    __tablename__ = "organization_entitlement_overrides"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    seat_count: Mapped[int] = mapped_column(Integer, nullable=True)
    max_custom_mcp_servers: Mapped[int] = mapped_column(Integer, nullable=True)
    log_retention_days: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, init=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        init=False,
    )
    organization: Mapped[Organization] = relationship(
        back_populates="entitlement_overrides", init=False
    )
