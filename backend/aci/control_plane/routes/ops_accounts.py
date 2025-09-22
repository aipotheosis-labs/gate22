from typing import Annotated
from uuid import UUID

from authlib.jose import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServer, OpsAccount
from aci.common.enums import AuthType, OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.oauth2_manager import OAuth2Manager
from aci.common.schemas.mcp_auth import (
    APIKeyCredentials,
    AuthConfig,
    NoAuthCredentials,
    OAuth2Config,
)
from aci.common.schemas.ops_account import (
    OAuth2OpsAccountCreateResponse,
    OpsAccountAPIKeyCreate,
    OpsAccountCreate,
    OpsAccountNoAuthCreate,
    OpsAccountOAuth2Create,
    OpsAccountOAuth2CreateState,
    OpsAccountPublic,
)
from aci.control_plane import access_control, config
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import (
    MCPServerNotFound,
    NotPermittedError,
    OAuth2Error,
)

logger = get_logger(__name__)
router = APIRouter()
OPS_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME = "ops_accounts_oauth2_callback"


@router.post("")
async def create_ops_account(
    request: Request,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: OpsAccountCreate,
) -> OAuth2OpsAccountCreateResponse | OpsAccountPublic:
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        context.db_session, body.mcp_server_id, throw_error_if_not_found=False
    )
    if not mcp_server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    if mcp_server.organization_id is None:
        raise NotPermittedError(message="Cannot create ops account for Public MCP server")

    # Check if the user is the admin of the organization that the MCP server belongs to
    access_control.check_act_as_organization_role(
        context.act_as,
        requested_organization_id=mcp_server.organization_id,
        required_role=OrganizationRole.ADMIN,
        throw_error_if_not_permitted=True,
    )

    match body.auth_type:
        case AuthType.OAUTH2:
            redirect_url_after_account_creation = OpsAccountOAuth2Create.model_validate(
                body.model_dump(exclude_none=True)
            ).redirect_url_after_account_creation
            return await _create_oauth2_ops_account(
                request,
                context,
                mcp_server,
                redirect_url_after_account_creation,
            )
        case AuthType.API_KEY:
            api_key = OpsAccountAPIKeyCreate.model_validate(
                body.model_dump(exclude_none=True)
            ).api_key
            ops_account = await _create_api_key_ops_account(
                context.db_session,
                context.user_id,
                mcp_server,
                api_key,
            )
            context.db_session.commit()
            return OpsAccountPublic.model_validate(ops_account, from_attributes=True)
        case AuthType.NO_AUTH:
            OpsAccountNoAuthCreate.model_validate(body.model_dump(exclude_none=True))
            ops_account = await _create_no_auth_ops_account(
                context.db_session,
                context.user_id,
                mcp_server,
            )
            context.db_session.commit()
            return OpsAccountPublic.model_validate(ops_account, from_attributes=True)


async def _create_api_key_ops_account(
    db_session: Session,
    user_id: UUID,
    mcp_server: MCPServer,
    api_key: str,
) -> OpsAccount:
    auth_credentials = APIKeyCredentials(type=AuthType.API_KEY, secret_key=api_key)
    return await _upsert_mcp_server_ops_account(
        db_session, user_id, mcp_server, auth_credentials.model_dump(mode="json")
    )


async def _create_no_auth_ops_account(
    db_session: Session,
    user_id: UUID,
    mcp_server: MCPServer,
) -> OpsAccount:
    auth_credentials = NoAuthCredentials(type=AuthType.NO_AUTH)
    return await _upsert_mcp_server_ops_account(
        db_session, user_id, mcp_server, auth_credentials.model_dump(mode="json")
    )


async def _upsert_mcp_server_ops_account(
    db_session: Session,
    user_id: UUID,
    mcp_server: MCPServer,
    auth_credentials: dict,
) -> OpsAccount:
    ops_account = mcp_server.ops_account

    # if the ops account already exists, delete it and create a new one
    if ops_account:
        crud.ops_accounts.update_ops_account_auth_credentials(
            db_session, ops_account.id, auth_credentials, user_id
        )
    else:
        ops_account = crud.ops_accounts.create_ops_account(
            db_session,
            user_id,
            mcp_server.id,
            auth_credentials,
        )
    return ops_account


async def _create_oauth2_ops_account(
    request: Request,
    context: deps.RequestContext,
    mcp_server: MCPServer,
    redirect_url_after_account_creation: str | None,
) -> OAuth2OpsAccountCreateResponse:
    oauth2_config = None
    for auth_config_dict in mcp_server.auth_configs:
        auth_config = AuthConfig.model_validate(auth_config_dict)
        if isinstance(auth_config.root, OAuth2Config):
            oauth2_config = auth_config.root
            break

    if not oauth2_config:
        raise ValueError(f"No OAuth2 config found for mcp_server_id={mcp_server.id}")

    oauth2_manager = OAuth2Manager(
        app_name=mcp_server.name,
        client_id=oauth2_config.client_id,
        scope=oauth2_config.scope,
        authorize_url=oauth2_config.authorize_url,
        access_token_url=oauth2_config.access_token_url,
        refresh_token_url=oauth2_config.refresh_token_url,
        client_secret=oauth2_config.client_secret,
        token_endpoint_auth_method=oauth2_config.token_endpoint_auth_method,
    )

    # create and encode the state payload.
    # NOTE: the state payload is jwt encoded (signed), but it's not encrypted, anyone can decode it
    # TODO: add expiration check to the state payload for extra security
    oauth2_state = OpsAccountOAuth2CreateState(
        mcp_server_id=mcp_server.id,
        user_id=context.user_id,
        code_verifier=OAuth2Manager.generate_code_verifier(),
        redirect_url_after_account_creation=redirect_url_after_account_creation,
    )

    # decode() is needed to convert the bytes to a string (not decoding the jwt payload) for this
    # jwt library.
    oauth2_state_jwt = jwt.encode(
        {"alg": config.JWT_ALGORITHM},
        oauth2_state.model_dump(mode="json", exclude_none=True),
        config.JWT_SIGNING_KEY,
    ).decode()

    path = request.url_for(OPS_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME).path
    redirect_uri = f"{config.CONTROL_PLANE_BASE_URL}{path}"
    authorization_url = await oauth2_manager.create_authorization_url(
        redirect_uri=redirect_uri,
        state=oauth2_state_jwt,
        code_verifier=oauth2_state.code_verifier,
    )

    logger.info(f"Ops account oauth2 authorization url={authorization_url}")

    return OAuth2OpsAccountCreateResponse(authorization_url=authorization_url)


@router.get(
    "/oauth2/callback",
    name=OPS_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME,
    response_model=OpsAccountPublic,
    response_model_exclude_none=True,
)
async def oauth2_callback(
    request: Request,
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
) -> OpsAccountPublic | RedirectResponse:
    """
    Callback endpoint for OAuth2 Ops account creation.
    - A Ops account (with necessary credentials from the OAuth2 provider) will be created in
    the database.
    """
    # check for errors
    error = request.query_params.get("error")
    error_description = request.query_params.get("error_description")
    if error:
        logger.error(
            f"OAuth2 account creation callback received, error={error}, "
            f"error_description={error_description}"
        )
        raise OAuth2Error(
            f"oauth2 account creation callback error: {error}, "
            f"error_description: {error_description}"
        )

    # check for code
    code = request.query_params.get("code")
    if not code:
        logger.error("OAuth2 account creation callback received, missing code")
        raise OAuth2Error("missing code parameter during account creation")

    # check for state
    state_jwt = request.query_params.get("state")
    if not state_jwt:
        logger.error(
            "OAuth2 account creation callback received, missing state",
        )
        raise OAuth2Error("missing state parameter during account creation")

    # decode the state payload
    try:
        state = OpsAccountOAuth2CreateState.model_validate(
            jwt.decode(state_jwt, config.JWT_SIGNING_KEY)
        )
        logger.info(
            f"OAuth2 account creation callback received, decoded "
            f"state={state.model_dump(exclude_none=True)}",
        )
    except Exception as e:
        logger.exception(f"Failed to decode OAuth2 state, error={e}")
        raise OAuth2Error("invalid state parameter during account linking") from e

    mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        db_session, state.mcp_server_id, throw_error_if_not_found=False
    )
    if not mcp_server:
        logger.error(
            f"Unable to continue with ops account creation, mcp server not found "
            f"mcp_server_id={state.mcp_server_id}"
        )
        raise MCPServerNotFound(f"mcp server={state.mcp_server_id} not found")

    # create oauth2 manager
    oauth2_config = None
    for auth_config_dict in mcp_server.auth_configs:
        auth_config = AuthConfig.model_validate(auth_config_dict)
        if isinstance(auth_config.root, OAuth2Config):
            oauth2_config = auth_config.root
            break

    if not oauth2_config:
        raise ValueError(f"No OAuth2 config found for mcp_server_id={mcp_server.id}")

    oauth2_manager = OAuth2Manager(
        app_name=mcp_server.name,
        client_id=oauth2_config.client_id,
        scope=oauth2_config.scope,
        authorize_url=oauth2_config.authorize_url,
        access_token_url=oauth2_config.access_token_url,
        refresh_token_url=oauth2_config.refresh_token_url,
        client_secret=oauth2_config.client_secret,
        token_endpoint_auth_method=oauth2_config.token_endpoint_auth_method,
    )

    path = request.url_for(OPS_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME).path
    redirect_uri = f"{config.CONTROL_PLANE_BASE_URL}{path}"
    token_response = await oauth2_manager.fetch_token(
        redirect_uri=redirect_uri,
        code=code,
        code_verifier=state.code_verifier,
    )
    auth_credentials = oauth2_manager.parse_fetch_token_response(token_response)

    ops_account = await _upsert_mcp_server_ops_account(
        db_session, state.user_id, mcp_server, auth_credentials.model_dump(mode="json")
    )
    db_session.commit()

    if state.redirect_url_after_account_creation:
        return RedirectResponse(
            url=state.redirect_url_after_account_creation, status_code=status.HTTP_302_FOUND
        )

    return OpsAccountPublic.model_validate(ops_account, from_attributes=True)
