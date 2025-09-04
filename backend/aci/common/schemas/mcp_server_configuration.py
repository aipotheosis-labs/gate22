from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from aci.common.enums import AuthType
from aci.common.schemas.mcp_server import MCPServerPublic
from aci.common.schemas.mcp_tool import MCPToolPublicWithoutSchema
from aci.common.schemas.organization import TeamInfo


class MCPServerConfigurationCreate(BaseModel):
    """Create a new MCP configuration
    "all_tools_enabled=True" → ignore enabled_tools.
    "all_tools_enabled=False" AND non-empty enabled_tools → selectively enable that list.
    "all_tools_enabled=False" AND empty enabled_tools → all tools disabled.
    """

    # TODO: allow white-labeling by providingthe redirect url
    name: str
    # TODO: put magic number in constants
    description: str | None = Field(default=None, max_length=512)
    mcp_server_id: UUID
    auth_type: AuthType
    all_tools_enabled: bool = Field(default=True)
    enabled_tools: list[UUID] = Field(default_factory=list)
    allowed_teams: list[UUID] = Field(default_factory=list)

    # when all_tools_enabled is True, enabled_tools provided by user should be empty
    @model_validator(mode="after")
    def check_all_tools_enabled(self) -> "MCPServerConfigurationCreate":
        if self.all_tools_enabled and self.enabled_tools:
            raise ValueError(
                "all_tools_enabled and enabled_tools cannot be both True and non-empty"
            )
        return self


class MCPServerConfigurationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None)
    description: str | None = Field(default=None, max_length=512)
    all_tools_enabled: bool | None = None
    enabled_tools: list[UUID] | None = None
    allowed_teams: list[UUID] | None = None

    # when all_tools_enabled is True, enabled_tools provided by user should be empty
    @model_validator(mode="after")
    def check_all_tools_enabled(self) -> "MCPServerConfigurationUpdate":
        if self.all_tools_enabled and self.enabled_tools:
            raise ValueError(
                "all_tools_enabled and enabled_tools cannot be both True and non-empty"
            )
        return self


class MCPServerConfigurationPublic(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    mcp_server_id: UUID
    organization_id: UUID
    auth_type: AuthType
    all_tools_enabled: bool
    enabled_tools: list[MCPToolPublicWithoutSchema]
    allowed_teams: list[TeamInfo]

    created_at: datetime
    updated_at: datetime

    mcp_server: MCPServerPublic

    # TODO: scrub sensitive data from whitelabeling overrides if support in the future
