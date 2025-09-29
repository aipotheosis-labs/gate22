import enum
import re
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServer, Organization
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
    MCPServerPartialUpdateRequest,
    MCPServerPublic,
)
from aci.common.schemas.pagination import PaginationResponse
from aci.control_plane import config
from aci.control_plane.services.mcp_tools.mcp_tools_manager import MCPToolsDiff

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


@pytest.mark.parametrize("is_mcp_server_same_org", [True, False])
@pytest.mark.parametrize("is_too_frequent", [True, False])
@patch("aci.control_plane.routes.mcp_servers.MCPToolsManager")
def test_refresh_mcp_server_tools(
    mock_mcp_tools_manager_class: AsyncMock,
    test_client: TestClient,
    db_session: Session,
    dummy_access_token_admin: str,
    is_too_frequent: bool,
    is_mcp_server_same_org: bool,
    dummy_organization: Organization,
    dummy_mcp_server: MCPServer,
) -> None:
    # Set up the mock
    mock_mcp_tools_manager_instance = AsyncMock()
    mock_mcp_tools_manager_instance.refresh_mcp_tools.return_value = MCPToolsDiff(
        tools_created=[],
        tools_deleted=[],
        tools_updated=[],
        tools_unchanged=[],
    )
    mock_mcp_tools_manager_class.return_value = mock_mcp_tools_manager_instance

    dummy_mcp_server.organization_id = dummy_organization.id if is_mcp_server_same_org else None
    dummy_mcp_server.last_synced_at = (
        datetime.now(UTC) - timedelta(seconds=30)
        if is_too_frequent
        else datetime.now(UTC) - timedelta(days=30)
    )

    db_session.commit()

    response = test_client.post(
        f"{config.ROUTER_PREFIX_MCP_SERVERS}/{dummy_mcp_server.id}/refresh-tools",
        headers={"Authorization": f"Bearer {dummy_access_token_admin}"},
    )

    if not is_mcp_server_same_org:
        assert response.status_code == 403
        return

    if is_too_frequent:
        assert response.status_code == 429
        return

    assert response.status_code == 200
    assert mock_mcp_tools_manager_instance.refresh_mcp_tools.call_count == 1


MCPServerBelongsTo = enum.Enum("MCPServerBelongsTo", ["self", "another_org", "public"])


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
@pytest.mark.parametrize(
    "mcp_server_belongs_to",
    [MCPServerBelongsTo.self, MCPServerBelongsTo.another_org, MCPServerBelongsTo.public],
)
def test_delete_mcp_server(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    dummy_organization: Organization,
    dummy_mcp_server: MCPServer,
    access_token_fixture: str,
    mcp_server_belongs_to: MCPServerBelongsTo,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    dummy_random_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Other Organization",
        description="Dummy Other Organization Description",
    )

    # Set up MCP server based on test parameters
    if mcp_server_belongs_to == MCPServerBelongsTo.self:
        dummy_mcp_server.organization_id = dummy_organization.id
    elif mcp_server_belongs_to == MCPServerBelongsTo.another_org:
        dummy_mcp_server.organization_id = dummy_random_organization.id
    else:  # public MCP server
        dummy_mcp_server.organization_id = None

    db_session.commit()

    response = test_client.delete(
        f"{config.ROUTER_PREFIX_MCP_SERVERS}/{dummy_mcp_server.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    # Check access control first
    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    # Check if trying to delete a MCP server that is not belongs to the organization
    if (
        mcp_server_belongs_to == MCPServerBelongsTo.public
        or mcp_server_belongs_to == MCPServerBelongsTo.another_org
    ):
        assert response.status_code == 403
        return

    if access_token_fixture != "dummy_access_token_admin":
        assert response.status_code == 403
        return

    assert response.status_code == 200

    # Verify the MCP server was actually deleted from the database
    deleted_mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        db_session, dummy_mcp_server.id, throw_error_if_not_found=False
    )
    assert deleted_mcp_server is None


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
@pytest.mark.parametrize(
    "mcp_server_belongs_to",
    [MCPServerBelongsTo.self, MCPServerBelongsTo.another_org, MCPServerBelongsTo.public],
)
@pytest.mark.parametrize(
    "update_data",
    [
        MCPServerPartialUpdateRequest(
            description="Updated description",
            logo="https://updated-logo.com/logo.png",
            categories=["updated", "test"],
        ),
        MCPServerPartialUpdateRequest(
            description="Updated description",
        ),
        MCPServerPartialUpdateRequest(),
    ],
)
def test_update_mcp_server(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    dummy_organization: Organization,
    dummy_mcp_server: MCPServer,
    access_token_fixture: str,
    mcp_server_belongs_to: MCPServerBelongsTo,
    update_data: MCPServerPartialUpdateRequest,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    dummy_random_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Other Organization",
        description="Dummy Other Organization Description",
    )

    # Set up MCP server based on test parameters
    if mcp_server_belongs_to == MCPServerBelongsTo.self:
        dummy_mcp_server.organization_id = dummy_organization.id
    elif mcp_server_belongs_to == MCPServerBelongsTo.another_org:
        dummy_mcp_server.organization_id = dummy_random_organization.id
    else:  # public MCP server
        dummy_mcp_server.organization_id = None

    db_session.commit()

    # Verify the MCP server was actually updated in the database
    original_mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        db_session, dummy_mcp_server.id, throw_error_if_not_found=True
    )

    response = test_client.patch(
        f"{config.ROUTER_PREFIX_MCP_SERVERS}/{dummy_mcp_server.id}",
        headers={"Authorization": f"Bearer {access_token}"},
        json=update_data.model_dump(exclude_unset=True),
    )

    # Check access control first
    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    # Check if trying to update a MCP server that is not belongs to the organization
    if (
        mcp_server_belongs_to == MCPServerBelongsTo.public
        or mcp_server_belongs_to == MCPServerBelongsTo.another_org
    ):
        assert response.status_code == 403
        return

    if access_token_fixture != "dummy_access_token_admin":
        assert response.status_code == 403
        return

    assert response.status_code == 200

    # Verify the response contains updated data
    MCPServerPublic.model_validate(response.json())

    # Verify the MCP server was actually updated in the database
    db_mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        db_session, dummy_mcp_server.id, throw_error_if_not_found=True
    )

    assert (
        db_mcp_server.description == update_data.description
        if update_data.description is not None
        else original_mcp_server.description
    )
    assert (
        db_mcp_server.logo == update_data.logo
        if update_data.logo is not None
        else original_mcp_server.logo
    )
    assert (
        db_mcp_server.categories == update_data.categories
        if update_data.categories is not None
        else original_mcp_server.categories
    )
