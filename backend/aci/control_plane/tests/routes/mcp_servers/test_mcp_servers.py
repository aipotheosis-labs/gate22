import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import Organization
from aci.common.enums import (
    AuthType,
    HttpLocation,
    MCPServerTransportType,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import APIKeyConfig, AuthConfig, NoAuthConfig
from aci.common.schemas.mcp_server import (
    CustomMCPServerCreateRequest,
    MCPServerMetadata,
    MCPServerPublic,
)
from aci.common.schemas.pagination import PaginationResponse
from aci.control_plane import config

logger = get_logger(__name__)


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
    ],
)
@pytest.mark.parametrize("has_custom_mcp_server", [True, False])
@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_mcp_servers(
    request: pytest.FixtureRequest,
    test_client: TestClient,
    db_session: Session,
    offset: int,
    dummy_organization: Organization,
    dummy_mcp_servers: list[MCPServerPublic],
    dummy_custom_mcp_server: MCPServerPublic,
    has_custom_mcp_server: bool,
    access_token_fixture: str,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    params = {}
    if offset is not None:
        params["offset"] = offset

    dummy_random_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Other Organization",
        description="Dummy Other Organization Description",
    )

    if has_custom_mcp_server:
        dummy_custom_mcp_server.organization_id = dummy_organization.id
    else:
        dummy_custom_mcp_server.organization_id = dummy_random_organization.id
    db_session.commit()

    response = test_client.get(
        config.ROUTER_PREFIX_MCP_SERVERS,
        params=params,
        headers={"Authorization": f"Bearer {access_token}"},
    )

    logger.info(f"Access token fixture: {access_token_fixture}")
    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    paginated_response = PaginationResponse[MCPServerPublic].model_validate(response.json())
    assert response.status_code == 200
    assert paginated_response.offset == (offset if offset is not None else 0)

    if offset is None or offset == 0:
        # dummy_mcp_servers has 3 public MCP servers + 1 custom MCP server (dummy_custom_mcp_server)
        if has_custom_mcp_server:
            assert len(paginated_response.data) == len(dummy_mcp_servers)
            assert dummy_custom_mcp_server.id in [data.id for data in paginated_response.data]
        else:
            assert len(paginated_response.data) == len(dummy_mcp_servers) - 1
            assert dummy_custom_mcp_server.id not in [data.id for data in paginated_response.data]

    else:
        assert len(paginated_response.data) == 0


def test_create_custom_mcp_server_with_invalid_operational_account_auth_type(
    test_client: TestClient,
    dummy_access_token_admin: str,
) -> None:
    response = test_client.post(
        config.ROUTER_PREFIX_MCP_SERVERS,
        headers={"Authorization": f"Bearer {dummy_access_token_admin}"},
        json={
            "name": "TEST_MCP_SERVER",
            "url": "https://test-mcp-server.com",
            "description": "Test MCP server",
            "categories": ["test"],
            "transport_type": MCPServerTransportType.STREAMABLE_HTTP,
            "auth_configs": [
                AuthConfig.model_validate(
                    APIKeyConfig(
                        type=AuthType.API_KEY, location=HttpLocation.HEADER, name="X-API-Key"
                    )
                ).model_dump(),
            ],
            "logo": "https://test-mcp-server.com/logo.png",
            "server_metadata": MCPServerMetadata().model_dump(),
            "operational_account_auth_type": AuthType.NO_AUTH.value,
            # Invalid operational_account_auth_type (not in auth_configs)
        },
    )
    assert response.status_code == 422


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

    input_mcp_server_data = CustomMCPServerCreateRequest(
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
        operational_account_auth_type=AuthType.NO_AUTH,
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

    # Check if the operational MCPServerConfiguration is created
    db_mcp_server_configuration_data = (
        crud.mcp_server_configurations.get_operational_mcp_server_configuration_mcp_server_id(
            db_session,
            mcp_server_id=db_mcp_server_data.id,
        )
    )
    assert db_mcp_server_configuration_data is not None


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
    ],
)
@pytest.mark.parametrize("is_public_mcp_server", [True, False])
@pytest.mark.parametrize("is_custom_mcp_server_same_org", [True, False])
def test_get_mcp_server(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    dummy_mcp_server: MCPServerPublic,
    dummy_organization: Organization,
    is_custom_mcp_server_same_org: bool,
    is_public_mcp_server: bool,
    access_token_fixture: str,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    dummy_random_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Other Organization",
        description="Dummy Other Organization Description",
    )

    if is_public_mcp_server:
        dummy_mcp_server.organization_id = None
    else:
        if is_custom_mcp_server_same_org:
            dummy_mcp_server.organization_id = dummy_organization.id
        else:
            dummy_mcp_server.organization_id = dummy_random_organization.id
    db_session.commit()

    response = test_client.get(
        f"{config.ROUTER_PREFIX_MCP_SERVERS}/{dummy_mcp_server.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if access_token_fixture in ["dummy_access_token_no_orgs"]:
        assert response.status_code == 403
        return

    if not is_public_mcp_server and not is_custom_mcp_server_same_org:
        # other org's custom MCP server
        assert response.status_code == 403
        assert response.json()["error"].startswith("Not permitted")
        return

    assert response.status_code == 200
    mcp_server_data = MCPServerPublic.model_validate(response.json())

    assert mcp_server_data.id == dummy_mcp_server.id
    assert mcp_server_data.name == dummy_mcp_server.name
    assert mcp_server_data.url == dummy_mcp_server.url
