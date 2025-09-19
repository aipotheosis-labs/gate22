from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedAsDataclass, mapped_column, relationship

from aci.common.enums import (
    AuthType,
    ConnectedAccountOwnership,
    MCPServerTransportType,
    OrganizationRole,
    TeamRole,
    UserIdentityProvider,
    UserVerificationType,
)

EMBEDDING_DIMENSION = 1024
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
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, init=False
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, init=False
    )

    organization_memberships: Mapped[list[OrganizationMembership]] = relationship(
        back_populates="user", cascade="all", passive_deletes=True, init=False
    )
    team_memberships: Mapped[list[TeamMembership]] = relationship(
        back_populates="user", cascade="all", passive_deletes=True, init=False
    )
    refresh_tokens: Mapped[list[UserRefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan", init=False
    )


class UserRefreshToken(Base):
    __tablename__ = "user_refresh_tokens"
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, init=False
    )
    user: Mapped[User] = relationship(back_populates="refresh_tokens", init=False)


class UserVerification(Base):
    __tablename__ = "user_verifications"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[UserVerificationType] = mapped_column(
        SQLEnum(UserVerificationType, native_enum=False, length=MAX_ENUM_LENGTH), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(
        String(MAX_STRING_LENGTH), unique=True, nullable=False
    )  # HMAC-SHA256(secret, token)
    email_metadata: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )  # email provider, send time, reference id
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, init=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, init=False
    )

    # No relationship needed - only using user_id foreign key directly


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)

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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, init=False
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
    description: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)

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
        back_populates="team",
        cascade="all, delete-orphan",
        single_parent=True,
        foreign_keys="TeamMembership.team_id",
        init=False,
    )

    # TODO: team name should be unique within an organization?
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uc_org_team"),
        # Add unique constraint for the compound foreign key: to be used in the TeamMembership
        # table's ForeignKeyConstraint
        UniqueConstraint("id", "organization_id", name="uc_team_org"),
    )


class TeamMembership(Base):
    __tablename__ = "team_memberships"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )

    team_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    # NOTE: organization_id is added here for the ForeignKeyConstraint below
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
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

    team: Mapped[Team] = relationship(
        back_populates="memberships", init=False, foreign_keys=[team_id]
    )
    user: Mapped[User] = relationship(back_populates="team_memberships", init=False)

    # TODO: should probably have test coverage for these constraints
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uc_team_user"),
        # Foreign key to ensure organization_id matches the team's organization
        ForeignKeyConstraint(
            ["team_id", "organization_id"],
            ["teams.id", "teams.organization_id"],
            name="fk_team_org_consistency",
            ondelete="CASCADE",  # Team deletion cascades to its memberships
        ),
        # Foreign key to ensure user is a member of the organization
        ForeignKeyConstraint(
            ["organization_id", "user_id"],
            ["organization_memberships.organization_id", "organization_memberships.user_id"],
            name="fk_user_org_membership",
            ondelete="CASCADE",  # Org membership removal cascades to team memberships
        ),
    )


class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), unique=True, nullable=False)
    # e.g., https://example.com/mcp
    url: Mapped[str] = mapped_column(Text, nullable=False)

    # Custom MCP Server, null if it is a public MCP Server
    organization_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        server_default=None,
    )

    # Last time the MCP Server was synced for the tool list.
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, server_default=None
    )

    description: Mapped[str] = mapped_column(Text, nullable=False)
    transport_type: Mapped[MCPServerTransportType] = mapped_column(
        SQLEnum(MCPServerTransportType, native_enum=False, length=MAX_ENUM_LENGTH), nullable=False
    )
    logo: Mapped[str] = mapped_column(Text, nullable=False)
    # TODO: consider adding a category table
    categories: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    # NOTE: a mcp server might support multiple auth types, e.g., both oauth2 and api key
    auth_configs: Mapped[list[dict]] = mapped_column(ARRAY(JSONB), nullable=False)
    server_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSION), nullable=False)

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

    tools: Mapped[list[MCPTool]] = relationship(
        back_populates="mcp_server", cascade="all, delete-orphan", init=False
    )

    ops_account: Mapped[OpsAccount | None] = relationship(
        back_populates="mcp_server", init=False, uselist=False
    )


class MCPTool(Base):
    __tablename__ = "mcp_tools"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    mcp_server_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False
    )
    # NOTE: the name of the tool is not the same as the canonical tool name from the mcp server.
    # e.g., the canonical tool name is "create-pull-request" and the name of the tool
    # can be "GITHUB__CREATE_PULL_REQUEST"
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False, unique=True)
    # NOTE: the description might not be the exact same as the canonical tool description from the
    # mcp server, as some of them might be too long (e.g., openai require < 1024 characters)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    input_schema: Mapped[dict] = mapped_column(JSONB, nullable=False)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    tool_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSION), nullable=False)

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

    mcp_server: Mapped[MCPServer] = relationship(back_populates="tools", init=False)


# NOTE:
# - each org can configure the same mcp server multiple times
class MCPServerConfiguration(Base):
    __tablename__ = "mcp_server_configurations"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False)
    description: Mapped[str | None] = mapped_column(String(MAX_STRING_LENGTH), nullable=True)
    mcp_server_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    auth_type: Mapped[AuthType] = mapped_column(
        SQLEnum(AuthType, native_enum=False, length=MAX_ENUM_LENGTH), nullable=False
    )
    connected_account_ownership: Mapped[ConnectedAccountOwnership] = mapped_column(
        SQLEnum(ConnectedAccountOwnership, native_enum=False, length=MAX_ENUM_LENGTH),
        nullable=False,
    )

    # TODO: add whitelabel overrides?
    all_tools_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # A list of tool ids
    enabled_tools: Mapped[list[UUID]] = mapped_column(ARRAY(PGUUID(as_uuid=True)), nullable=False)

    # TODO: need to check teams actually belongs to the org on app layer
    # whitelisted teams that can use this mcp server configuration
    allowed_teams: Mapped[list[UUID]] = mapped_column(ARRAY(PGUUID(as_uuid=True)), nullable=False)

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

    # one way relationship to the mcp server
    mcp_server: Mapped[MCPServer] = relationship("MCPServer", init=False)


# TODO:
# - for now, connected account is tied to mcp server configuration, not mcp server
# - for simplicity, we only support one connected account per user per mcp server configuration
# - we might need to support multiple connected accounts per user per mcp server (configuration)
class ConnectedAccount(Base):
    __tablename__ = "connected_accounts"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    mcp_server_configuration_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("mcp_server_configurations.id", ondelete="CASCADE"),
        nullable=False,
    )
    auth_credentials: Mapped[dict] = mapped_column(JSONB, nullable=False)

    ownership: Mapped[ConnectedAccountOwnership] = mapped_column(
        SQLEnum(ConnectedAccountOwnership, native_enum=False, length=MAX_ENUM_LENGTH),
        nullable=False,
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

    mcp_server_configuration: Mapped[MCPServerConfiguration] = relationship(
        "MCPServerConfiguration", init=False
    )

    user: Mapped[User] = relationship("User", init=False)

    # TODO: consider composite key instead
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "mcp_server_configuration_id",
            name="uc_connected_accounts_one_per_user_per_mcp_server_config",
        ),
    )


# One Custom MCP Server (non-public) would have one OpsAccount.
class OpsAccount(Base):
    __tablename__ = "ops_accounts"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    mcp_server_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False
    )
    auth_credentials: Mapped[dict] = mapped_column(JSONB, nullable=False)

    created_by_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
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

    mcp_server: Mapped[MCPServer] = relationship(back_populates="ops_account", init=False)

    # Ensure one ops account per MCP server
    __table_args__ = (UniqueConstraint("mcp_server_id", name="uc_ops_account_mcp_server"),)


class MCPServerBundle(Base):
    __tablename__ = "mcp_server_bundles"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # user who created the mcp server bundle
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    # a list of mcp server configuration ids the bundle contains
    # TODO: should only allow mcp server configurations of the same mcp server once
    # TODO: should probably only allow mcp server configurations that the user has connected to
    mcp_server_configuration_ids: Mapped[list[UUID]] = mapped_column(
        ARRAY(PGUUID(as_uuid=True)), nullable=False
    )
    user: Mapped[User] = relationship("User", init=False)

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


# TODO: sessions table for mcp server that require sessions


###################################################################################################
# Below tables are used only by the "virtual MCP" service hosting virtual MCP Servers
# see design doc:
# https://www.notion.so/Design-Doc-a-new-service-as-the-execution-engine-for-virtual-MCP-servers-integration-based-26b8378d6a4780b4a389cf302d021c49
###################################################################################################


class VirtualMCPServer(Base):
    """
    This table is close to the "App" table of the tool-calling platform but many fields removed.
    We can almost get rid of this table and combine the data with VirtualMCPTool table, but
    for now we keep it separate to follow the same design pattern we have, for a
    better forward compatibility.
    """

    __tablename__ = "virtual_mcp_servers"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)

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

    tools: Mapped[list[VirtualMCPTool]] = relationship(
        back_populates="server", cascade="all, delete-orphan", init=False
    )


class VirtualMCPTool(Base):
    __tablename__ = "virtual_mcp_tools"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default_factory=uuid4, init=False
    )
    virtual_mcp_server_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("virtual_mcp_servers.id", ondelete="CASCADE"),
        nullable=False,
    )
    # NOTE: here we still prefix "app name" (e.g., "GMAIL__SEND_EMAIL"), but in the response of
    # tools/list (requested by unified mcp) we will strip off the prefix (e.g., "SEND_EMAIL")
    # we can do this because we will have the "app name" in the mcp url (as query parameter)
    # e.g., https://mcp.aci.dev/virtual/mcp?name=GMAIL
    name: Mapped[str] = mapped_column(String(MAX_STRING_LENGTH), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # NOTE: this input_schema will include "visibility" field for "rest" protocol type
    # But they will be stripped off in the response of tools/list (requested by unified mcp)
    input_schema: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # NOTE: tool_metadata serves similar function as the "protocol & protocol_data" field in the
    # tool-calling platform
    tool_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False)

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

    server: Mapped[VirtualMCPServer] = relationship(
        "VirtualMCPServer", back_populates="tools", init=False
    )
