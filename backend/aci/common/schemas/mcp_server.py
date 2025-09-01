import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from aci.common.enums import AuthType, MCPServerTransportType
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_tool import MCPToolPublicWithoutSchema


# NOTE: using a generic metadata schema for now before the schema is finalized
# TODO: for now this is not used, some potential useful fields: "need_session"
class MCPServerMetadata(BaseModel):
    pass

    model_config = ConfigDict(extra="forbid")


class MCPServerUpsert(BaseModel, extra="forbid"):
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
        if not re.match(r"^[A-Z0-9_]+$", v) or "__" in v:
            raise ValueError(
                "name must be uppercase, contain only letters, numbers and underscores, and not "
                "have consecutive underscores"
            )
        return v


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
    # TODO: is it necessary to expose transport_type?
    description: str
    logo: str
    categories: list[str]
    supported_auth_types: list[AuthType]

    tools: list[MCPToolPublicWithoutSchema]

    created_at: datetime
    updated_at: datetime
