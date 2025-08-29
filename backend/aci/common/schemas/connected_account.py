from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from aci.common.schemas.mcp_server_configuration import MCPServerConfigurationPublicBasic


class ConnectedAccountCreate(BaseModel):
    mcp_server_configuration_id: UUID
    # TODO: typing for different auth data of different auth types?
    redirect_url_after_account_creation: str | None = None


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

    mcp_server_configuration: MCPServerConfigurationPublicBasic
