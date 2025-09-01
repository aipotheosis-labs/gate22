from collections.abc import AsyncGenerator

import httpx

from aci.common.schemas.mcp_auth import (
    APIKeyConfig,
    APIKeyCredentials,
    AuthConfig,
    AuthCredentials,
    NoAuthConfig,
    NoAuthCredentials,
    OAuth2Config,
    OAuth2Credentials,
)


# TODO: for now the MCPAuthManager is somewhat "static", meaning it doesn't support
# refreshing token or updating refreshed token back to the database. This is fine for now because
# we create and destroy the streamablehttp_client and ClientSession for each user request.
# In the future, if we want to support long-lived connections, we need to implement a more
# sophisticated auth credentials manager that can refresh tokens and update refreshed tokens back
# to the database, similar to OAuthClientProvider from mcp python sdk.
class MCPAuthManager(httpx.Auth):
    def __init__(self, auth_config: AuthConfig, auth_credentials: AuthCredentials):
        self.auth_config = auth_config
        self.auth_credentials = auth_credentials

    async def async_auth_flow(
        self, request: httpx.Request
    ) -> AsyncGenerator[httpx.Request, httpx.Response]:
        # TODO: better way to do type narrowing?
        # TODO: for now assume only headers are supported for credentials
        if isinstance(self.auth_config.root, OAuth2Config) and isinstance(
            self.auth_credentials.root, OAuth2Credentials
        ):
            request.headers[self.auth_config.root.name] = (
                f"{self.auth_config.root.prefix} {self.auth_credentials.root.access_token}"
                if self.auth_config.root.prefix
                else self.auth_credentials.root.access_token
            )
        elif isinstance(self.auth_config.root, APIKeyConfig) and isinstance(
            self.auth_credentials.root, APIKeyCredentials
        ):
            request.headers[self.auth_config.root.name] = self.auth_credentials.root.secret_key
        elif isinstance(self.auth_config.root, NoAuthConfig) and isinstance(
            self.auth_credentials.root, NoAuthCredentials
        ):
            pass
        else:
            raise ValueError(
                f"Unsupported auth config and credentials: {self.auth_config}, {self.auth_credentials}"  # noqa: E501
            )
        yield request
