from typing import Annotated
from uuid import UUID

from authlib.jose import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServerConfiguration
from aci.common.enums import AuthType, OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.connected_account import (
    ConnectedAccountCreate,
    ConnectedAccountOAuth2CreateState,
    ConnectedAccountPublic,
    OAuth2ConnectedAccountCreateResponse,
)
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import auth_credentials_manager as acm
from aci.control_plane import config, rbac
from aci.control_plane import dependencies as deps
from aci.control_plane.exceptions import (
    MCPServerConfigurationNotFound,
    NotPermittedError,
    OAuth2Error,
)
from aci.control_plane.oauth2_manager import OAuth2Manager

logger = get_logger(__name__)
router = APIRouter()
CONNECTED_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME = "connected_accounts_oauth2_callback"


@router.post("")
async def create_connected_account(
    request: Request,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: ConnectedAccountCreate,
) -> OAuth2ConnectedAccountCreateResponse:
    mcp_server_config = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        context.db_session, body.mcp_server_configuration_id, throw_error_if_not_found=False
    )
    # TODO: check user has access to the mcp server configuration

    if not mcp_server_config:
        raise HTTPException(status_code=404, detail="MCP server configuration not found")

    match mcp_server_config.auth_type:
        case AuthType.NO_AUTH:
            # TODO: support no auth and api key auth
            raise HTTPException(status_code=400, detail="No auth type is not supported")
        case AuthType.API_KEY:
            raise HTTPException(status_code=400, detail="API key auth type is not supported")
        case AuthType.OAUTH2:
            return await _create_oauth2_connected_account(
                request, context, mcp_server_config, body.redirect_url_after_account_creation
            )


async def _create_oauth2_connected_account(
    request: Request,
    context: deps.RequestContext,
    mcp_server_config: MCPServerConfiguration,
    redirect_url_after_account_creation: str | None,
) -> OAuth2ConnectedAccountCreateResponse:
    oauth2_config = acm.get_mcp_server_configuration_oauth2_config(
        mcp_server_config.mcp_server, mcp_server_config
    )

    oauth2_manager = OAuth2Manager(
        app_name=mcp_server_config.mcp_server.name,
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
    oauth2_state = ConnectedAccountOAuth2CreateState(
        mcp_server_configuration_id=mcp_server_config.id,
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

    path = request.url_for(CONNECTED_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME).path
    redirect_uri = f"{config.REDIRECT_URI_BASE}{path}"
    authorization_url = await oauth2_manager.create_authorization_url(
        redirect_uri=redirect_uri,
        state=oauth2_state_jwt,
        code_verifier=oauth2_state.code_verifier,
    )

    logger.info(f"Connected account oauth2 authorization url={authorization_url}")

    return OAuth2ConnectedAccountCreateResponse(authorization_url=authorization_url)


@router.get(
    "/oauth2/callback",
    name=CONNECTED_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME,
    response_model=ConnectedAccountPublic,
    response_model_exclude_none=True,
)
async def oauth2_callback(
    request: Request,
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
) -> ConnectedAccountPublic | RedirectResponse:
    """
    Callback endpoint for OAuth2 account creation.
    - A connected account (with necessary credentials from the OAuth2 provider) will be created in
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
        state = ConnectedAccountOAuth2CreateState.model_validate(
            jwt.decode(state_jwt, config.JWT_SIGNING_KEY)
        )
        logger.info(
            f"OAuth2 account creation callback received, decoded "
            f"state={state.model_dump(exclude_none=True)}",
        )
    except Exception as e:
        logger.exception(f"Failed to decode OAuth2 state, error={e}")
        raise OAuth2Error("invalid state parameter during account linking") from e

    mcp_server_configuration = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        db_session, state.mcp_server_configuration_id, throw_error_if_not_found=False
    )
    if not mcp_server_configuration:
        logger.error(
            f"Unable to continue with account creation, mcp server configuration not found "
            f"mcp_server_configuration_id={state.mcp_server_configuration_id}"
        )
        raise MCPServerConfigurationNotFound(
            f"mcp server configuration={state.mcp_server_configuration_id} not found"
        )

    # create oauth2 manager
    oauth2_config = acm.get_mcp_server_configuration_oauth2_config(
        mcp_server_configuration.mcp_server, mcp_server_configuration
    )

    oauth2_manager = OAuth2Manager(
        app_name=mcp_server_configuration.mcp_server.name,
        client_id=oauth2_config.client_id,
        scope=oauth2_config.scope,
        authorize_url=oauth2_config.authorize_url,
        access_token_url=oauth2_config.access_token_url,
        refresh_token_url=oauth2_config.refresh_token_url,
        client_secret=oauth2_config.client_secret,
        token_endpoint_auth_method=oauth2_config.token_endpoint_auth_method,
    )

    path = request.url_for(CONNECTED_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME).path
    redirect_uri = f"{config.REDIRECT_URI_BASE}{path}"
    token_response = await oauth2_manager.fetch_token(
        redirect_uri=redirect_uri,
        code=code,
        code_verifier=state.code_verifier,
    )
    auth_credentials = oauth2_manager.parse_fetch_token_response(token_response)

    # if the connected account already exists, update it, otherwise create a new one
    # TODO: consider separating the logic for updating and creating a connected account or give
    # warning to clients if the connected account already exists to avoid accidental overwriting the
    # account
    # TODO: try/except, retry?
    connected_account = (
        crud.connected_accounts.get_connected_account_by_user_id_and_mcp_server_configuration_id(
            db_session,
            state.user_id,
            mcp_server_configuration.id,
        )
    )
    if connected_account:
        logger.info(
            f"Updating oauth2 credentials for connected account, "
            f"connected_account_id={connected_account.id}"
        )
        connected_account = crud.connected_accounts.update_connected_account_auth_credentials(
            db_session, connected_account, auth_credentials.model_dump(mode="json")
        )
    else:
        logger.info(
            f"Creating oauth2 connected account, "
            f"mcp_server_configuration_id={mcp_server_configuration.id}, "
            f"user_id={state.user_id}"
        )
        connected_account = crud.connected_accounts.create_connected_account(
            db_session,
            state.user_id,
            mcp_server_configuration.id,
            auth_credentials.model_dump(mode="json"),
        )
    db_session.commit()

    if state.redirect_url_after_account_creation:
        return RedirectResponse(
            url=state.redirect_url_after_account_creation, status_code=status.HTTP_302_FOUND
        )

    return ConnectedAccountPublic.model_validate(connected_account, from_attributes=True)


@router.get("", response_model=PaginationResponse[ConnectedAccountPublic])
async def list_connected_accounts(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[ConnectedAccountPublic]:
    if context.act_as.role == OrganizationRole.ADMIN:
        # Admin can see all connected accounts of the organization
        connected_accounts = crud.connected_accounts.get_connected_accounts_by_organization_id(
            context.db_session,
            context.act_as.organization_id,
            offset=pagination_params.offset,
            limit=pagination_params.limit,
        )
    else:
        # Member can see connected accounts of the themselves
        connected_accounts = (
            crud.connected_accounts.get_connected_accounts_by_user_id_and_organization_id(
                context.db_session,
                context.user_id,
                context.act_as.organization_id,
                offset=pagination_params.offset,
                limit=pagination_params.limit,
            )
        )

    return PaginationResponse[ConnectedAccountPublic](
        data=[
            ConnectedAccountPublic.model_validate(connected_account, from_attributes=True)
            for connected_account in connected_accounts
        ],
        offset=pagination_params.offset,
    )


@router.delete("/{connected_account_id}")
async def delete_connected_account(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    connected_account_id: UUID,
) -> None:
    # TODO: Admin can only delete shared accounts. (Shared account is not implemented yet)
    # If a person is acted as an admin, they cannot do any deletion at this moment.
    if context.act_as.role != OrganizationRole.MEMBER:
        raise HTTPException(status_code=403, detail="Forbidden")

    connected_account = crud.connected_accounts.get_connected_account_by_id(
        context.db_session, connected_account_id
    )
    if connected_account is not None:
        rbac.check_permission(
            context.act_as,
            requested_organization_id=connected_account.mcp_server_configuration.organization_id,
            throw_error_if_not_permitted=True,
        )
        if context.user_id != connected_account.user_id:
            raise NotPermittedError(message="Cannot delete others' connected accounts")

        # Delete the connected account
        crud.connected_accounts.delete_connected_account(context.db_session, connected_account_id)

        context.db_session.commit()
    else:
        raise HTTPException(status_code=404, detail="Connected account not found")
