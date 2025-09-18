import string
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from sqlalchemy.orm import Session

from aci.common import embeddings, utils
from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server import (
    CustomMCPServerCreate,
    MCPServerEmbeddingFields,
    MCPServerPublic,
)
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import access_control, config, schema_utils
from aci.control_plane import dependencies as deps

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
