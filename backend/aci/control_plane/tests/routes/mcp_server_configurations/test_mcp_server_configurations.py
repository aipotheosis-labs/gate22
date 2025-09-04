from enum import Enum
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServer, MCPServerConfiguration, Team
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationPublic,
    MCPServerConfigurationUpdate,
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

    # dummy_mcp_server_configurations has 2 dummy MCP server configurations,
    # both allowed [dummy_team]
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
        config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS,
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
    )

    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    paginated_response = PaginationResponse[MCPServerConfigurationPublic].model_validate(
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
                # Should see 2 mcp server configuration as both have allowed dummy_team
                assert len(paginated_response.data) == 2
                assert config_added_to_team.id in [
                    response_item.id for response_item in paginated_response.data
                ]
                assert config_added_to_team.mcp_server.id in [
                    response_item.mcp_server.id for response_item in paginated_response.data
                ]
            else:
                # Should only see 1 mcp server configuration as the other one has no allowed_teams
                assert len(paginated_response.data) == 1
                assert config_added_to_team.id not in [
                    response_item.id for response_item in paginated_response.data
                ]
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
        f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}/{dummy_mcp_server_configuration.id}",
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


EnabledToolTestCase = Enum(
    "EnabledToolTestCase",
    ["empty", "non_empty", "all_enabled", "all_enabled_but_non_empty", "include_invalid", "none"],
)
AllowedTeamTestCase = Enum(
    "AllowedTeamTestCase",
    ["empty", "non_empty", "include_invalid", "none"],
)


@pytest.mark.parametrize(
    ("name", "description", "tool_test_case", "team_test_case", "expected_status_code"),
    [
        ("New Name", "New Description", EnabledToolTestCase.none, AllowedTeamTestCase.none, 200),
        ("New Name", None, EnabledToolTestCase.all_enabled, AllowedTeamTestCase.empty, 200),
        ("New Name", None, EnabledToolTestCase.all_enabled, AllowedTeamTestCase.non_empty, 200),
        (
            "New Name",
            None,
            EnabledToolTestCase.all_enabled,
            AllowedTeamTestCase.include_invalid,
            400,
        ),
        ("New Name", None, EnabledToolTestCase.all_enabled, AllowedTeamTestCase.none, 200),
        (None, "New Description", EnabledToolTestCase.all_enabled, AllowedTeamTestCase.none, 200),
        (None, None, EnabledToolTestCase.none, AllowedTeamTestCase.none, 200),
        (None, None, EnabledToolTestCase.empty, AllowedTeamTestCase.none, 200),
        (None, None, EnabledToolTestCase.all_enabled, AllowedTeamTestCase.none, 200),
        (None, None, EnabledToolTestCase.non_empty, AllowedTeamTestCase.none, 200),
        (None, None, EnabledToolTestCase.include_invalid, AllowedTeamTestCase.none, 400),
        (None, None, EnabledToolTestCase.all_enabled_but_non_empty, AllowedTeamTestCase.none, 422),
    ],
)
def test_update_mcp_server_configuration_input_validation(
    test_client: TestClient,
    db_session: Session,
    dummy_access_token_admin: str,
    dummy_mcp_server_configuration: MCPServerConfiguration,
    dummy_mcp_server: MCPServer,
    dummy_team: Team,
    name: str,
    description: str,
    tool_test_case: EnabledToolTestCase,
    team_test_case: AllowedTeamTestCase,
    expected_status_code: int,
) -> None:
    all_tools_enabled: bool | None = None
    enabled_tools: list[UUID] | None = None
    match tool_test_case:
        case EnabledToolTestCase.none:
            all_tools_enabled = None
            enabled_tools = None
        case EnabledToolTestCase.empty:
            all_tools_enabled = True
            enabled_tools = []
        case EnabledToolTestCase.non_empty:
            all_tools_enabled = False
            enabled_tools = [dummy_mcp_server.tools[0].id, dummy_mcp_server.tools[1].id]
        case EnabledToolTestCase.all_enabled:
            all_tools_enabled = True
            enabled_tools = []
        case EnabledToolTestCase.all_enabled_but_non_empty:
            all_tools_enabled = True
            enabled_tools = [dummy_mcp_server.tools[0].id, dummy_mcp_server.tools[1].id]
        case EnabledToolTestCase.include_invalid:
            all_tools_enabled = False
            enabled_tools = [dummy_mcp_server.tools[0].id, uuid4()]

    allowed_teams: list[UUID] | None = None
    match team_test_case:
        case AllowedTeamTestCase.empty:
            allowed_teams = []
        case AllowedTeamTestCase.non_empty:
            allowed_teams = [dummy_team.id]
        case AllowedTeamTestCase.include_invalid:
            allowed_teams = [uuid4()]
        case AllowedTeamTestCase.none:
            allowed_teams = None

    body: dict[str, Any] = {}
    if name is not None:
        body["name"] = name
    if description is not None:
        body["description"] = description
    if all_tools_enabled is not None:
        body["all_tools_enabled"] = all_tools_enabled
    if enabled_tools is not None:
        body["enabled_tools"] = [str(tool_id) for tool_id in enabled_tools]
    if allowed_teams is not None:
        body["allowed_teams"] = [str(team_id) for team_id in allowed_teams]

    original = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        db_session=db_session,
        mcp_server_configuration_id=dummy_mcp_server_configuration.id,
        throw_error_if_not_found=False,
    )
    assert original is not None

    response = test_client.patch(
        f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}/{dummy_mcp_server_configuration.id}",
        headers={"Authorization": f"Bearer {dummy_access_token_admin}"},
        json=body,
    )

    assert response.status_code == expected_status_code

    if expected_status_code == 200:
        new_config = MCPServerConfigurationPublic.model_validate(
            response.json(),
        )
        assert new_config is not None
        # Check there response is correct
        _assert_mcp_server_configuration_changes(
            original,
            MCPServerConfigurationUpdate.model_validate(**body),
            new_config,
        )

        # Check the data are updated in the database
        db_config_after_update = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
            db_session=db_session,
            mcp_server_configuration_id=dummy_mcp_server_configuration.id,
            throw_error_if_not_found=False,
        )
        assert db_config_after_update is not None

        _assert_mcp_server_configuration_changes(
            original,
            MCPServerConfigurationUpdate.model_validate(**body),
            db_config_after_update,
        )


def _assert_mcp_server_configuration_changes(
    original: MCPServerConfiguration,
    update: MCPServerConfigurationUpdate,
    new: MCPServerConfiguration | MCPServerConfigurationPublic,
) -> None:
    if update.name is not None:
        assert new.name == update.name
    else:
        assert new.name == original.name

    if update.description is not None:
        assert new.description == update.description
    else:
        assert new.description == original.description

    if update.all_tools_enabled is not None:
        assert new.all_tools_enabled == update.all_tools_enabled
    else:
        assert new.all_tools_enabled == original.all_tools_enabled

    if update.enabled_tools is not None:
        if isinstance(new, MCPServerConfigurationPublic):
            assert [tool.id for tool in new.enabled_tools] == update.enabled_tools
        else:
            assert new.enabled_tools == update.enabled_tools
    else:
        if isinstance(new, MCPServerConfigurationPublic):
            assert [tool.id for tool in new.enabled_tools] == original.enabled_tools
        else:
            assert new.enabled_tools == original.enabled_tools

    if update.allowed_teams is not None:
        if isinstance(new, MCPServerConfigurationPublic):
            assert [team.team_id for team in new.allowed_teams] == update.allowed_teams
        else:
            assert new.allowed_teams == update.allowed_teams
    else:
        if isinstance(new, MCPServerConfigurationPublic):
            assert [team.team_id for team in new.allowed_teams] == original.allowed_teams
        else:
            assert new.allowed_teams == original.allowed_teams


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
def test_delete_mcp_server_configuration(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_mcp_server_configuration: MCPServerConfiguration,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    response = test_client.delete(
        f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}/{dummy_mcp_server_configuration.id}",
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
