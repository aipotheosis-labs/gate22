import string
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from openai import OpenAI
from pydantic import AnyUrl, HttpUrl
from sqlalchemy.orm import Session

from aci.common import embeddings, utils
from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server import (
    CustomMCPServerCreate,
    MCPServerEmbeddingFields,
    MCPServerOAuth2DiscoveryRequest,
    MCPServerOAuth2DiscoveryResponse,
    MCPServerPublic,
)
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import access_control, config, schema_utils
from aci.control_plane import dependencies as deps
from aci.control_plane.routes.connected_accounts import (
    CONNECTED_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME,
)
from aci.control_plane.services.oauth2_client import (
    ClientRegistrator,
    MetadataFetcher,
    OAuthClientMetadata,
)

logger = get_logger(__name__)
router = APIRouter()

# TODO: singleton globally
openai_client = OpenAI(api_key=config.OPENAI_API_KEY)


# TODO: support both query by mcp server id and name
@router.get("/{mcp_server_id}", response_model=MCPServerPublic)
async def get_mcp_server(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_id: UUID,
) -> MCPServerPublic:
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        context.db_session, mcp_server_id, throw_error_if_not_found=False
    )
    if not mcp_server:
        # TODO: should we only use custom error class here, e.g, MCPServerNotFoundError?
        raise HTTPException(status_code=404, detail="MCP server not found")

    return schema_utils.construct_mcp_server_public(mcp_server)


@router.get("")
async def list_mcp_servers(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[MCPServerPublic]:
    # TODO: support search by keywords / categories (currently filtering is done in Frontend)

    mcp_servers = crud.mcp_servers.list_mcp_servers(
        db_session, offset=pagination_params.offset, limit=pagination_params.limit
    )

    return PaginationResponse(
        data=[schema_utils.construct_mcp_server_public(mcp_server) for mcp_server in mcp_servers],
        offset=pagination_params.offset,
    )


def _generate_unique_mcp_server_canonical_name(
    db_session: Session, name: str, max_trials: int = 10
) -> str:
    """
    Generate a unique MCP server canonical name. If collision happens, try max. max_trials times.
    Return None if failed.
    """
    for _ in range(max_trials):
        random_id = utils.generate_alphanumeric_string(
            8, character_pool=string.ascii_uppercase + string.digits
        )
        canonical_name = f"{name}_{random_id}"
        if not crud.mcp_servers.get_mcp_server_by_name(
            db_session, canonical_name, throw_error_if_not_found=False
        ):
            return canonical_name

    logger.error(
        f"Failed to generate a unique MCP server canonical name for {name} after {max_trials} tries"
    )
    raise Exception(
        f"Failed to generate a unique MCP server canonical name for {name} after {max_trials} tries"
    )


@router.post("", response_model=MCPServerPublic)
async def create_custom_mcp_server(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_data: CustomMCPServerCreate,
) -> MCPServerPublic:
    access_control.check_act_as_organization_role(
        context.act_as, required_role=OrganizationRole.ADMIN
    )

    mcp_server_embedding = embeddings.generate_mcp_server_embedding(
        openai_client,
        MCPServerEmbeddingFields(
            name=mcp_server_data.name,
            url=mcp_server_data.url,
            description=mcp_server_data.description,
            categories=mcp_server_data.categories,
        ),
    )

    canonical_name = _generate_unique_mcp_server_canonical_name(
        context.db_session, mcp_server_data.name
    )

    mcp_server_data.name = canonical_name

    mcp_server = crud.mcp_servers.create_custom_mcp_server(
        context.db_session,
        organization_id=context.act_as.organization_id,
        custom_mcp_server_upsert=mcp_server_data,
        embedding=mcp_server_embedding,
    )

    mcp_server_public = schema_utils.construct_mcp_server_public(mcp_server)
    return mcp_server_public


@router.post(
    "/oauth2-discovery",
    description=(
        "Discover OAuth2 Metadata and optionally perform dynamic client registration (DCR) for MCP "
        "server. Note that this does not result in any record creation or update in Control Plane."
    ),
)
async def mcp_server_oauth2_discovery(
    request: Request,
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: MCPServerOAuth2DiscoveryRequest,
) -> MCPServerOAuth2DiscoveryResponse:
    # Enforce only admin to perform this action
    access_control.check_act_as_organization_role(
        context.act_as, required_role=OrganizationRole.ADMIN
    )

    result = MCPServerOAuth2DiscoveryResponse(
        authorize_url=None,
        access_token_url=None,
        refresh_token_url=None,
        client_id=None,
        client_secret=None,
    )

    # Step 1: Discover OAuth metadata
    try:
        oauth2_metadata_fetcher = MetadataFetcher(str(body.url))
        oauth2_metadata = oauth2_metadata_fetcher.metadata_discovery()
        result.authorize_url = str(oauth2_metadata.authorization_endpoint)
        result.access_token_url = str(oauth2_metadata.token_endpoint)
        result.refresh_token_url = str(oauth2_metadata.token_endpoint)
    except Exception as e:
        logger.info(f"Failed to fetch OAuth metadata: {e}. URL: {body.url}")
        return result

    # Step 2: Perform dynamic client registration (DCR) if requested

    # For whitelabeling purposes, we allow user to provide custom callback URL for their MCP OAuth2
    # flow. If not provided, we use the default callback URL in our API.
    if body.dcr:
        redirect_uris: list[AnyUrl] = []
        if body.redirect_uri is None:
            path = request.url_for(CONNECTED_ACCOUNTS_OAUTH2_CALLBACK_ROUTE_NAME).path
            redirect_uris = [HttpUrl(f"{config.CONTROL_PLANE_BASE_URL}{path}")]
        else:
            redirect_uris = [body.redirect_uri]

        try:
            oauth2_client_registrator = ClientRegistrator(
                str(body.url),
                client_metadata=OAuthClientMetadata(
                    redirect_uris=redirect_uris,
                    # TODO: should we support client_secret_basic in the future?
                    token_endpoint_auth_method="none",
                    grant_types=["authorization_code", "refresh_token"],
                    response_types=["code"],
                    scope="",  # TODO: discover default scope
                ),
                oauth_metadata=oauth2_metadata,
            )
            client_info = oauth2_client_registrator.dynamic_client_registration()
            result.client_id = client_info.client_id
            result.client_secret = client_info.client_secret
        except Exception as e:
            logger.info(f"Failed to register client: {e}. URL: {body.url}")
            return result

    return result
