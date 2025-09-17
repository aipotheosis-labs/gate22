import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import Organization
from aci.common.enums import AuthType, HttpLocation, MCPServerTransportType
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import APIKeyConfig, AuthConfig, NoAuthConfig
from aci.common.schemas.mcp_server import CustomMCPServerCreate, MCPServerMetadata, MCPServerPublic
from aci.common.schemas.pagination import PaginationResponse
from aci.control_plane import config

logger = get_logger(__name__)


@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_mcp_servers(
    test_client: TestClient,
    offset: int,
    dummy_access_token_no_orgs: str,
    dummy_mcp_servers: list[MCPServerPublic],
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
        assert [data.name for data in paginated_response.data] == sorted(
            [dummy_mcp_server.name for dummy_mcp_server in dummy_mcp_servers]
        )
    else:
        assert len(paginated_response.data) == 0


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
def test_create_custom_mcp_server(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    dummy_organization: Organization,
    access_token_fixture: str,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    input_mcp_server_data = CustomMCPServerCreate(
        name="TEST_MCP_SERVER",
        url="https://test-mcp-server.com",
        description="Test MCP server",
        categories=["test"],
        transport_type=MCPServerTransportType.STREAMABLE_HTTP,
        auth_configs=[
            AuthConfig.model_validate(
                APIKeyConfig(type=AuthType.API_KEY, location=HttpLocation.HEADER, name="X-API-Key")
            ),
            AuthConfig.model_validate(NoAuthConfig(type=AuthType.NO_AUTH)),
        ],
        logo="https://test-mcp-server.com/logo.png",
        server_metadata=MCPServerMetadata(),
    )

    response = test_client.post(
        config.ROUTER_PREFIX_MCP_SERVERS,
        headers={"Authorization": f"Bearer {access_token}"},
        json=input_mcp_server_data.model_dump(mode="json"),
    )

    # Only admin can create custom MCP server
    if access_token_fixture != "dummy_access_token_admin":
        assert response.status_code == 403
        return

    assert response.status_code == 200
    mcp_server_data = MCPServerPublic.model_validate(response.json(), from_attributes=True)

    # Check if the MCP server is created in the database
    db_mcp_server_data = crud.mcp_servers.get_mcp_server_by_name(
        db_session, mcp_server_data.name, throw_error_if_not_found=False
    )
    assert db_mcp_server_data is not None

    assert db_mcp_server_data.url == input_mcp_server_data.url
    assert db_mcp_server_data.description == input_mcp_server_data.description
    assert db_mcp_server_data.categories == input_mcp_server_data.categories
    assert db_mcp_server_data.transport_type == input_mcp_server_data.transport_type
    assert db_mcp_server_data.logo == input_mcp_server_data.logo

    # Check if the organization id is set
    assert db_mcp_server_data.organization_id == dummy_organization.id

    # Check if the MCP server name is generated correctly
    assert re.fullmatch(f"{input_mcp_server_data.name}_[A-Z0-9]{{8}}", db_mcp_server_data.name)
