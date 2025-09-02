from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, RootModel

from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationPublic,
)


class ConnectedAccountAPIKeyCreate(BaseModel):
    mcp_server_configuration_id: UUID
    api_key: str = Field(min_length=1)  # for API key auth type. # TODO: use SecretStr


class ConnectedAccountOAuth2Create(BaseModel):
    mcp_server_configuration_id: UUID
    redirect_url_after_account_creation: str | None = None  # for OAuth2 auth type


class ConnectedAccountNoAuthCreate(BaseModel):
    mcp_server_configuration_id: UUID


class ConnectedAccountCreate(
    RootModel[
        ConnectedAccountAPIKeyCreate | ConnectedAccountOAuth2Create | ConnectedAccountNoAuthCreate
    ]
):
    root: ConnectedAccountAPIKeyCreate | ConnectedAccountOAuth2Create | ConnectedAccountNoAuthCreate


class OAuth2ConnectedAccountCreateResponse(BaseModel):
    authorization_url: str


class ConnectedAccountOAuth2CreateState(BaseModel):
    mcp_server_configuration_id: UUID
    user_id: UUID
    code_verifier: str
    redirect_url_after_account_creation: str | None = None
    # TODO: add expires at?


class ConnectedAccountPublic(BaseModel):
    id: UUID
    user_id: UUID
    mcp_server_configuration_id: UUID
    # TODO: add auth credentials (with access token, refresh token removed)

    created_at: datetime
    updated_at: datetime

    mcp_server_configuration: MCPServerConfigurationPublic
