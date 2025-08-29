import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServer, MCPServerConfiguration, Team
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationPublic,
    MCPServerConfigurationPublicBasic,
)
from aci.common.schemas.pagination import PaginationResponse

logger = get_logger(__name__)


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
@pytest.mark.parametrize("is_added_to_team", [True, False])
@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_mcp_server_configurations(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_mcp_server_configurations: list[MCPServerConfiguration],
    dummy_mcp_server: MCPServer,
    dummy_team: Team,
    is_added_to_team: bool,
    offset: int | None,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # dummy_mcp_server_configurations has 2 dummy MCP server configurations, both without team
    config_added_to_team = dummy_mcp_server_configurations[0]
    if is_added_to_team:
        config_added_to_team.allowed_teams = [dummy_team.id]
    else:
        config_added_to_team.allowed_teams = []
    db_session.commit()

    params = {}
    if offset is not None:
        params["offset"] = offset

    response = test_client.get(
        "/v1/mcp-server-configurations",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
    )

    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    paginated_response = PaginationResponse[MCPServerConfigurationPublicBasic].model_validate(
        response.json(),
    )

    assert paginated_response.offset == (offset if offset is not None else 0)

    if offset is None or offset == 0:
        if access_token_fixture == "dummy_access_token_admin":
            # Should see all the MCP server configurations, regardless of allowed_teams
            assert response.status_code == 200
            assert len(paginated_response.data) == len(dummy_mcp_server_configurations)
            assert any(
                dummy_mcp_server.id == response_item.mcp_server.id
                for response_item in paginated_response.data
            )

        elif access_token_fixture in [
            "dummy_access_token_member",
            "dummy_access_token_admin_act_as_member",
        ]:
            # Should only see the MCP server configuration that the user belongs to
            assert response.status_code == 200
            if is_added_to_team:
                # Should see only 1 mcp server configuration as it is added to the user's teams
                assert len(paginated_response.data) == 1
                assert paginated_response.data[0].id == config_added_to_team.id
                assert (
                    paginated_response.data[0].mcp_server.id == config_added_to_team.mcp_server.id
                )
            else:
                # Should not see any MCP server configuration
                assert len(paginated_response.data) == 0
        else:
            raise Exception("Untested access token fixture")

    else:
        # shows nothing because offset should be larger than the total test MCP server configs
        assert len(paginated_response.data) == 0


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
        "dummy_access_token_another_org",
    ],
)
@pytest.mark.parametrize("is_added_to_team", [True, False])
def test_get_mcp_server_configuration(
    test_client: TestClient,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    db_session: Session,
    dummy_team: Team,
    dummy_mcp_server_configuration: MCPServerConfiguration,
    is_added_to_team: bool,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    if is_added_to_team:
        dummy_mcp_server_configuration.allowed_teams = [dummy_team.id]
    else:
        dummy_mcp_server_configuration.allowed_teams = []
    db_session.commit()

    response = test_client.get(
        f"/v1/mcp-server-configurations/{dummy_mcp_server_configuration.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if access_token_fixture in ["dummy_access_token_no_orgs", "dummy_access_token_another_org"]:
        # Should not be able to see the MCP server configuration
        assert response.status_code == 403
        return

    elif access_token_fixture == "dummy_access_token_admin":
        # Should be able to see the MCP server configuration
        assert response.status_code == 200
        mcp_server_configuration = MCPServerConfigurationPublic.model_validate(
            response.json(),
        )
        assert mcp_server_configuration.id == dummy_mcp_server_configuration.id
        assert len(mcp_server_configuration.allowed_teams) == 0 if not is_added_to_team else 1

    elif access_token_fixture in [
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ]:
        # Should only see the MCP server configuration that the user belongs to
        if is_added_to_team:
            assert response.status_code == 200
            mcp_server_configuration = MCPServerConfigurationPublic.model_validate(
                response.json(),
            )
            assert mcp_server_configuration.id == dummy_mcp_server_configuration.id
            assert len(mcp_server_configuration.allowed_teams) == 1
            assert mcp_server_configuration.allowed_teams[0].team_id == dummy_team.id
        else:
            # Should not see any MCP server configuration
            assert response.status_code == 403
            assert response.json()["error"].startswith("Not permitted")
    else:
        raise Exception("Untested access token fixture")


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
        "dummy_access_token_another_org",
    ],
)
@pytest.mark.parametrize("is_added_to_team", [True, False])
def test_delete_mcp_server_configuration(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    is_added_to_team: bool,
    dummy_team: Team,
    dummy_mcp_server_configuration: MCPServerConfiguration,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    if is_added_to_team:
        dummy_mcp_server_configuration.allowed_teams = [dummy_team.id]
    else:
        dummy_mcp_server_configuration.allowed_teams = []
    db_session.commit()

    response = test_client.delete(
        f"/v1/mcp-server-configurations/{dummy_mcp_server_configuration.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    # Only admin can delete MCP server configuration
    if access_token_fixture == "dummy_access_token_admin":
        assert response.status_code == 200

        # Check if the MCP server configuration is deleted
        assert (
            crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
                db_session=db_session,
                mcp_server_configuration_id=dummy_mcp_server_configuration.id,
                throw_error_if_not_found=False,
            )
            is None
        )

    else:
        # Should not be able to delete the MCP server configuration
        assert response.status_code == 403
