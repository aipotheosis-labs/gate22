from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from aci.common.enums import AuthType
from aci.common.schemas.mcp_server import MCPServerPublicBasic
from aci.common.schemas.mcp_tool import MCPToolPublic
from aci.common.schemas.organization import TeamInfo


class MCPServerConfigurationCreate(BaseModel):
    """Create a new MCP configuration
    "all_tools_enabled=True" → ignore enabled_tools.
    "all_tools_enabled=False" AND non-empty enabled_tools → selectively enable that list.
    "all_tools_enabled=False" AND empty enabled_tools → all tools disabled.
    """

    # TODO: allow white-labeling by providingthe redirect url
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


class MCPServerConfigurationPublic(BaseModel):
    id: UUID
    mcp_server_id: UUID
    organization_id: UUID
    auth_type: AuthType
    all_tools_enabled: bool
    enabled_tools: list[MCPToolPublic]
    allowed_teams: list[TeamInfo]

    created_at: datetime
    updated_at: datetime

    mcp_server: MCPServerPublicBasic

    # TODO: scrub sensitive data from whitelabeling overrides if support in the future


class MCPServerConfigurationPublicBasic(BaseModel):
    id: UUID
    mcp_server_id: UUID
    mcp_server: MCPServerPublicBasic
