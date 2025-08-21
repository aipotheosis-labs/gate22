from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column, relationship

from aci.common.enums import OrganizationRole, TeamRole, UserIdentityProvider

MAX_STRING_LENGTH = 512
MAX_ENUM_LENGTH = 50


class Base(MappedAsDataclass, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    # TODO: should the same email but from different providers be considered the same user
    # (e.g., google and github)?
    identity_provider: Mapped[UserIdentityProvider] = mapped_column(
        SQLEnum(UserIdentityProvider, native_enum=False, length=MAX_ENUM_LENGTH), nullable=False
    )
    email: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), unique=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, server_default=false(), nullable=False)
    # TODO: split to first_name and last_name? should it be nullable?
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False)
    # TODO: is str type suitable for password hash?
    password_hash: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True, init=False
    )
    # TODO: what would this be used for?
    # TODO: if it's for soft deletion, should we add deleted_at column ? and
    # should Organization also use soft delete?
    is_active: Mapped[bool] = mapped_column(
        Boolean, server_default=false(), nullable=False, init=False
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

    organization_memberships: Mapped[list[OrganizationMembership]] = relationship(
        back_populates="user", cascade="all", passive_deletes=True, init=False
    )
    team_memberships: Mapped[list[TeamMembership]] = relationship(
        back_populates="user", cascade="all", passive_deletes=True, init=False
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    # TODO: should this be unique platform-wide?
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)

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

    # TODO: consider lazy loading for these relationships if we have a lot of data
    memberships: Mapped[list[OrganizationMembership]] = relationship(
        back_populates="organization", cascade="all, delete-orphan", single_parent=True, init=False
    )
    teams: Mapped[list[Team]] = relationship(
        back_populates="organization", cascade="all, delete-orphan", init=False
    )


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[OrganizationRole] = mapped_column(
        SQLEnum(OrganizationRole, native_enum=False, length=MAX_ENUM_LENGTH), nullable=False
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

    organization: Mapped[Organization] = relationship(back_populates="memberships", init=False)
    user: Mapped[User] = relationship(back_populates="organization_memberships", init=False)

    # NOTE: user can belong to multiple organizations, but not the same organization multiple times
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uc_org_user"),)


# NOTE: team belongs to exactly one organization, so no need for a join table
class Team(Base):
    __tablename__ = "teams"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)

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

    organization: Mapped[Organization] = relationship(back_populates="teams", init=False)
    memberships: Mapped[list[TeamMembership]] = relationship(
        back_populates="team", cascade="all, delete-orphan", single_parent=True, init=False
    )

    # TODO: team name should be unique within an organization?
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uc_org_team"),)


class TeamMembership(Base):
    __tablename__ = "team_memberships"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )

    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    role: Mapped[TeamRole] = mapped_column(
        SQLEnum(TeamRole, native_enum=False, length=MAX_ENUM_LENGTH), nullable=False
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

    team: Mapped[Team] = relationship(back_populates="memberships", init=False)
    user: Mapped[User] = relationship(back_populates="team_memberships", init=False)

    # TODO: should probably have test coverage for these constraints
    __table_args__ = (
        # Ensure team actually belongs to the organization
        ForeignKeyConstraint(
            ["team_id", "organization_id"],
            ["teams.id", "teams.organization_id"],
            ondelete="CASCADE",
        ),
        # Ensure user is already an organization member
        ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_memberships.organization_id", "organization_memberships.user_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("team_id", "user_id", name="uc_team_user"),
    )
