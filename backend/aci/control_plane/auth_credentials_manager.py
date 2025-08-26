# import time

from pydantic import TypeAdapter

# from sqlalchemy.orm import Session
# from aci.common.db import crud
from aci.common.db.sql_models import (
    MCPServer,
    MCPServerConfiguration,
)
from aci.common.enums import AuthType
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp.auth import AuthConfig, OAuth2Config
from aci.control_plane.exceptions import NoImplementationFound

logger = get_logger(__name__)


# # TODO: only pass necessary data to the functions
# class SecurityCredentialsResponse(BaseModel):
#     scheme: APIKeyScheme | OAuth2Scheme | NoAuthScheme
#     credentials: APIKeySchemeCredentials | OAuth2SchemeCredentials | NoAuthSchemeCredentials
#     is_app_default_credentials: bool
#     is_updated: bool


# async def get_security_credentials(
#     app: App, app_configuration: AppConfiguration, linked_account: LinkedAccount
# ) -> SecurityCredentialsResponse:
#     if linked_account.security_scheme == SecurityScheme.API_KEY:
#         return _get_api_key_credentials(app, linked_account)
#     elif linked_account.security_scheme == SecurityScheme.OAUTH2:
#         return await _get_oauth2_credentials(app, app_configuration, linked_account)
#     elif linked_account.security_scheme == SecurityScheme.NO_AUTH:
#         return _get_no_auth_credentials(app, linked_account)
#     else:
#         logger.error(
#             f"Unsupported security scheme, linked_account_id={linked_account.id}, "
#             f"security_scheme={linked_account.security_scheme}, app={app.name}"
#         )
#         raise NoImplementationFound(
#             f"unsupported security scheme={linked_account.security_scheme}, app={app.name}"
#         )


# def update_security_credentials(
#     db_session: Session,
#     app: App,
#     linked_account: LinkedAccount,
#     security_credentials_response: SecurityCredentialsResponse,
# ) -> None:
#     """
#     Update security credentials in the database.

#     Args:
#         db_session: Database session
#         app: App object
#         linked_account: Linked account object
#         security_credentials_response: The security credentials response to update
#     """
#     if not security_credentials_response.is_updated:
#         return

#     if security_credentials_response.is_app_default_credentials:
#         crud.apps.update_app_default_security_credentials(
#             db_session,
#             app,
#             linked_account.security_scheme,
#             security_credentials_response.credentials.model_dump(),
#         )
#     else:
#         crud.linked_accounts.update_linked_account_credentials(
#             db_session,
#             linked_account,
#             security_credentials=security_credentials_response.credentials,
#         )

#     db_session.refresh(linked_account)


# async def _get_oauth2_credentials(
#     app: App, app_configuration: AppConfiguration, linked_account: LinkedAccount
# ) -> SecurityCredentialsResponse:
#     """Get OAuth2 credentials from linked account or app's default credentials.
#     If the access token is expired, it will be refreshed.
#     """
#     is_updated = False
#     oauth2_scheme = get_app_configuration_oauth2_scheme(app_configuration.app, app_configuration)
#     oauth2_scheme_credentials = OAuth2SchemeCredentials.model_validate(
#         linked_account.security_credentials
#     )
#     if _access_token_is_expired(oauth2_scheme_credentials):
#         logger.warning(
#             f"Access token expired, trying to refresh linked_account_id={linked_account.id}, "
#             f"security_scheme={linked_account.security_scheme}, app={app.name}"
#         )
#         token_response = await _refresh_oauth2_access_token(
#             app.name, oauth2_scheme, oauth2_scheme_credentials
#         )
#         # TODO: refactor parsing to _refresh_oauth2_access_token
#         expires_at: int | None = None
#         if "expires_at" in token_response:
#             expires_at = int(token_response["expires_at"])
#         elif "expires_in" in token_response:
#             expires_at = int(time.time()) + int(token_response["expires_in"])

#         if not token_response.get("access_token") or not expires_at:
#             logger.error(
#                 f"Failed to refresh access token, token_response={token_response}, "
#                 f"app={app.name}, linked_account_id={linked_account.id}, "
#                 f"security_scheme={linked_account.security_scheme}"
#             )
#             raise OAuth2Error("failed to refresh access token")

#         fields_to_update = {
#             "access_token": token_response["access_token"],
#             "expires_at": expires_at,
#         }
#         # NOTE: some app's refresh token can only be used once, so we need to update the refresh
#         # token (if returned)
#         if token_response.get("refresh_token"):
#             fields_to_update["refresh_token"] = token_response["refresh_token"]

#         oauth2_scheme_credentials = oauth2_scheme_credentials.model_copy(
#             update=fields_to_update,
#         )
#         is_updated = True

#     return SecurityCredentialsResponse(
#         scheme=oauth2_scheme,
#         credentials=oauth2_scheme_credentials,
#         is_app_default_credentials=False,  # Should never support default credentials for oauth2
#         is_updated=is_updated,
#     )


# async def _refresh_oauth2_access_token(
#     app_name: str, oauth2_scheme: OAuth2Scheme, oauth2_scheme_credentials: OAuth2SchemeCredentials
# ) -> dict:
#     refresh_token = oauth2_scheme_credentials.refresh_token
#     if not refresh_token:
#         raise OAuth2Error("no refresh token found")

#     # NOTE: it's important to use oauth2_scheme_credentials's client_id, client_secret, scope
#     # because these fields might have changed for the app configuration after the linked account
#     # was created
#     oauth2_manager = OAuth2Manager(
#         app_name=app_name,
#         client_id=oauth2_scheme_credentials.client_id,
#         scope=oauth2_scheme_credentials.scope,
#         authorize_url=oauth2_scheme.authorize_url,
#         access_token_url=oauth2_scheme.access_token_url,
#         refresh_token_url=oauth2_scheme.refresh_token_url,
#         client_secret=oauth2_scheme_credentials.client_secret,
#         token_endpoint_auth_method=oauth2_scheme.token_endpoint_auth_method,
#     )

#     return await oauth2_manager.refresh_token(refresh_token)


# def _get_api_key_credentials(
#     app: App, linked_account: LinkedAccount
# ) -> SecurityCredentialsResponse:
#     """
#     Get API key credentials from linked account or use app's default credentials if no linked
#     account's API key is found.
#     and if the app has a default shared API key.
#     """
#     security_credentials = (
#         linked_account.security_credentials
#         or app.default_security_credentials_by_scheme.get(linked_account.security_scheme)
#     )

#     # use "not" to cover empty dict case
#     if not security_credentials:
#         logger.error(
#             f"No API key credentials usable, app={app.name}, "
#             f"security_scheme={linked_account.security_scheme}, "
#             f"linked_account_id={linked_account.id}"
#         )
#         raise NoImplementationFound(
#             f"No API key credentials usable for app={app.name}, "
#             f"security_scheme={linked_account.security_scheme}, "
#             f"linked_account_owner_id={linked_account.linked_account_owner_id}"
#         )

#     return SecurityCredentialsResponse(
#         scheme=APIKeyScheme.model_validate(app.security_schemes[SecurityScheme.API_KEY]),
#         credentials=APIKeySchemeCredentials.model_validate(security_credentials),
#         is_app_default_credentials=not bool(linked_account.security_credentials),
#         is_updated=False,
#     )


# def _get_no_auth_credentials(
#     app: App, linked_account: LinkedAccount
# ) -> SecurityCredentialsResponse:
#     """
#     a somewhat no-op function, but we keep it for consistency.
#     """
#     return SecurityCredentialsResponse(
#         scheme=NoAuthScheme.model_validate(app.security_schemes[SecurityScheme.NO_AUTH]),
#         credentials=NoAuthSchemeCredentials.model_validate(linked_account.security_credentials),
#         is_app_default_credentials=False,
#         is_updated=False,
#     )


# # TODO: consider adding leeway for expiration
# def _access_token_is_expired(oauth2_credentials: OAuth2SchemeCredentials) -> bool:
#     if oauth2_credentials.expires_at is None:
#         return False
#     return oauth2_credentials.expires_at < int(time.time())


def get_mcp_server_configuration_oauth2_config(
    mcp_server: MCPServer, mcp_server_configuration: MCPServerConfiguration
) -> OAuth2Config:
    """
    Get the OAuth2 scheme for an app configuration, taking into account potential overrides.
    """
    # TODO: optimize?
    type_adapter = TypeAdapter(list[AuthConfig])
    auth_configs = type_adapter.validate_python(mcp_server.auth_configs)
    for auth_config in auth_configs:
        if auth_config.type == AuthType.OAUTH2:
            return OAuth2Config.model_validate(auth_config)

    raise NoImplementationFound(
        f"No OAuth2 config found for mcp_server_id={mcp_server.id}, "
        f"mcp_server_configuration_id={mcp_server_configuration.id}"
    )
