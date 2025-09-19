import re
from datetime import datetime
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, field_validator

from aci.common.enums import AuthType, MCPServerTransportType
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_tool import MCPToolPublicWithoutSchema


# NOTE: using a generic metadata schema for now before the schema is finalized
# TODO: for now this is not used, some potential useful fields: "need_session"
class MCPServerMetadata(BaseModel):
    pass

    model_config = ConfigDict(extra="forbid")


class PublicMCPServerUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    url: str
    transport_type: MCPServerTransportType
    description: str
    logo: str
    categories: list[str]
    auth_configs: list[AuthConfig]
    server_metadata: MCPServerMetadata

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        msg = (
            "name must be uppercase, contain only letters, numbers and underscores, not "
            "have consecutive underscores, and not start or end with an underscore"
        )

        if v.startswith("_") or v.endswith("_"):
            raise ValueError(msg)

        if not re.match(r"^[A-Z0-9_]+$", v) or "__" in v:
            raise ValueError(msg)
        return v


# Currently Custom MCP Server has same fields as PublicMCPServerUpsert.
# But we should not extend PublicMCPServerUpsert in the future to avoid confusion.
class CustomMCPServerCreate(PublicMCPServerUpsert):
    pass


class MCPServerEmbeddingFields(BaseModel):
    """
    Fields used for generating the embeddings.
    """

    name: str
    url: str
    description: str
    categories: list[str]


class MCPServerPublic(BaseModel):
    id: UUID
    name: str
    url: str
    organization_id: UUID | None
    last_synced_at: datetime | None
    # TODO: is it necessary to expose transport_type?
    description: str
    logo: str
    categories: list[str]
    supported_auth_types: list[AuthType]

    tools: list[MCPToolPublicWithoutSchema]

    created_at: datetime
    updated_at: datetime


class MCPServerOAuth2DiscoveryRequest(BaseModel):
    mcp_server_url: AnyHttpUrl


class MCPServerOAuth2DiscoveryResponse(BaseModel):
    authorize_url: AnyHttpUrl | None = None
    access_token_url: AnyHttpUrl | None = None
    refresh_token_url: AnyHttpUrl | None = None

    # This could be none if DCR is not supported by the server
    registration_url: AnyHttpUrl | None = None
    token_endpoint_auth_method_supported: list[str]


class MCPServerOAuth2DCRRequest(BaseModel):
    mcp_server_url: AnyHttpUrl
    registration_url: AnyHttpUrl
    token_endpoint_auth_method_supported: list[str]


class MCPServerOAuth2DCRResponse(BaseModel):
    client_id: str | None = None
    client_secret: str | None = None
