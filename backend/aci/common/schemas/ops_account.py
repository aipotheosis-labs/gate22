from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from aci.common.enums import AuthType


class OpsAccountAPIKeyCreate(BaseModel, extra="forbid"):
    auth_type: Literal[AuthType.API_KEY] = Field(default=AuthType.API_KEY)
    mcp_server_id: UUID
    api_key: str = Field(min_length=1)  # for API key auth type. # TODO: use SecretStr


class OpsAccountOAuth2Create(BaseModel, extra="forbid"):
    auth_type: Literal[AuthType.OAUTH2] = Field(default=AuthType.OAUTH2)
    mcp_server_id: UUID
    redirect_url_after_account_creation: str | None = None  # for OAuth2 auth type


class OpsAccountNoAuthCreate(BaseModel, extra="forbid"):
    auth_type: Literal[AuthType.NO_AUTH] = Field(default=AuthType.NO_AUTH)
    mcp_server_id: UUID


OpsAccountCreate = Annotated[
    OpsAccountAPIKeyCreate | OpsAccountOAuth2Create | OpsAccountNoAuthCreate,
    Field(discriminator="auth_type"),
]


class OAuth2OpsAccountCreateResponse(BaseModel):
    authorization_url: str


class OpsAccountOAuth2CreateState(BaseModel):
    mcp_server_id: UUID
    user_id: UUID
    code_verifier: str
    redirect_url_after_account_creation: str | None = None
    # TODO: add expires at?


class OpsAccountPublic(BaseModel):
    id: UUID
    mcp_server_id: UUID

    created_at: datetime
    updated_at: datetime
