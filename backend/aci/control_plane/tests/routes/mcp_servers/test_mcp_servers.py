import pytest
from fastapi.testclient import TestClient

from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server import MCPServerPublic
from aci.common.schemas.pagination import PaginationResponse
from aci.control_plane import config

logger = get_logger(__name__)


@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_mcp_servers(
    test_client: TestClient,
    offset: int,
    dummy_access_token_no_orgs: str,
    dummy_mcp_servers: list[MCPServerPublic],
    dummy_mcp_server_notion: MCPServerPublic,
    dummy_mcp_server_github: MCPServerPublic,
) -> None:
    params = {}
    if offset is not None:
        params["offset"] = offset

    response = test_client.get(
        config.ROUTER_PREFIX_MCP_SERVERS,
        params=params,
        headers={"Authorization": f"Bearer {dummy_access_token_no_orgs}"},
    )
    paginated_response = PaginationResponse[MCPServerPublic].model_validate(response.json())

    assert response.status_code == 200
    assert paginated_response.offset == (offset if offset is not None else 0)

    if offset is None or offset == 0:
        assert len(paginated_response.data) == len(dummy_mcp_servers)

        # NOTE: sorted by name asc
        assert paginated_response.data[0].name == dummy_mcp_server_github.name
        assert paginated_response.data[1].name == dummy_mcp_server_notion.name
    else:
        assert len(paginated_response.data) == 0
