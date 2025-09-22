from enum import Enum
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import (
    ConnectedAccount,
    MCPServer,
    MCPServerBundle,
    MCPServerConfiguration,
    Team,
    User,
)
from aci.common.enums import ConnectedAccountOwnership
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationCreate,
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
@pytest.mark.parametrize("all_added_to_team", [True, False])
@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_mcp_server_configurations(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_mcp_server_configurations: list[MCPServerConfiguration],
    dummy_mcp_server: MCPServer,
    dummy_team: Team,
    all_added_to_team: bool,
    offset: int | None,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # dummy_mcp_server_configurations has 3 dummy MCP server configurations,
    # all allowed [dummy_team]
    target_config = dummy_mcp_server_configurations[0]
    if not all_added_to_team:
        # Remove dummy_team from one of the configurations
        target_config.allowed_teams = []
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
            if all_added_to_team:
                # Should see 3 mcp server configuration as all have allowed dummy_team
                assert len(paginated_response.data) == len(dummy_mcp_server_configurations)
                assert target_config.id in [
                    response_item.id for response_item in paginated_response.data
                ]
                assert target_config.mcp_server.id in [
                    response_item.mcp_server.id for response_item in paginated_response.data
                ]
            else:
                # One config had its allowed_teams cleared
                assert len(paginated_response.data) == len(dummy_mcp_server_configurations) - 1
                assert target_config.id not in [
                    response_item.id for response_item in paginated_response.data
                ]
        else:
            raise Exception("Untested access token fixture")

    else:
        # shows nothing because offset should be larger than the total test MCP server configs
        assert len(paginated_response.data) == 0


def test_list_mcp_server_configurations_by_mcp_server_id(
    test_client: TestClient,
    dummy_mcp_server: MCPServer,
    dummy_mcp_server_configurations: list[MCPServerConfiguration],
    dummy_access_token_member: str,
) -> None:
    response = test_client.get(
        f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}?mcp_server_id={dummy_mcp_server.id}",
        headers={"Authorization": f"Bearer {dummy_access_token_member}"},
    )

    assert response.status_code == 200
    paginated_response = PaginationResponse[MCPServerConfigurationPublic].model_validate(
        response.json(),
    )

    for response_item in paginated_response.data:
        logger.info(f"Response item: {response_item}")
        assert response_item.mcp_server.id == dummy_mcp_server.id


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
            MCPServerConfigurationUpdate.model_validate(body),
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
            MCPServerConfigurationUpdate.model_validate(body),
            db_config_after_update,
        )


def _assert_mcp_server_configuration_changes(
    original: MCPServerConfiguration,
    update: MCPServerConfigurationUpdate,
    new: MCPServerConfiguration | MCPServerConfigurationPublic,
) -> None:
    assert new.name == (original.name if update.name is None else update.name)
    assert new.description == (
        original.description if update.description is None else update.description
    )
    assert new.all_tools_enabled == (
        original.all_tools_enabled if update.all_tools_enabled is None else update.all_tools_enabled
    )

    def assert_sorted_ids(ids: list[UUID], expected: list[UUID]) -> None:
        assert sorted(ids, key=str) == sorted(expected, key=str)

    if isinstance(new, MCPServerConfigurationPublic):
        assert_sorted_ids(
            [tool.id for tool in new.enabled_tools],
            update.enabled_tools if update.enabled_tools is not None else original.enabled_tools,
        )
        assert_sorted_ids(
            [team.team_id for team in new.allowed_teams],
            update.allowed_teams if update.allowed_teams is not None else original.allowed_teams,
        )

    else:
        assert_sorted_ids(
            new.enabled_tools,
            update.enabled_tools if update.enabled_tools is not None else original.enabled_tools,
        )
        assert_sorted_ids(
            new.allowed_teams,
            update.allowed_teams if update.allowed_teams is not None else original.allowed_teams,
        )


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
@pytest.mark.parametrize("has_stale", [True, False])
def test_update_mcp_server_configuration(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_mcp_server_configuration: MCPServerConfiguration,
    dummy_team: Team,
    has_stale: bool,
    dummy_user: User,
    dummy_connected_accounts: list[ConnectedAccount],
    dummy_mcp_server_bundles: list[MCPServerBundle],
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # Originally:
    # - dummy_mcp_server_configuration has allowed_teams [dummy_team]
    # - dummy_user is under dummy_team, and has ConnectedAccount to dummy_mcp_server_configuration
    #
    # we add one more new team to dummy_mcp_server_configuration.allowed_teams
    # and add dummy_user to that new team for testing.
    #
    # If we remove new_team, dummy_user still has access to dummy_mcp_server_configuration
    # because dummy_team is still inside allowed_teams

    # If we remove both teams, dummy_user's will not have access to dummy_mcp_server_configuration.
    # Then the connected account will be considered as stale.
    # And any bundle should remove the dummy_mcp_server_configuration.

    new_team = crud.teams.create_team(
        db_session=db_session,
        name="New Team",
        organization_id=dummy_mcp_server_configuration.organization_id,
    )
    crud.teams.add_team_member(
        db_session=db_session,
        organization_id=dummy_mcp_server_configuration.organization_id,
        team_id=new_team.id,
        user_id=dummy_user.id,
    )
    dummy_mcp_server_configuration.allowed_teams = [dummy_team.id, new_team.id]
    db_session.commit()

    response = test_client.patch(
        f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}/{dummy_mcp_server_configuration.id}",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"allowed_teams": [] if has_stale else [str(dummy_team.id)]},
    )

    if access_token_fixture != "dummy_access_token_admin":
        assert response.status_code == 403
        return

    assert response.status_code == 200

    # Find the affected connected account
    affected_connected_accounts = [
        connected_account
        for connected_account in dummy_connected_accounts
        if connected_account.user_id == dummy_user.id
        and connected_account.mcp_server_configuration_id == dummy_mcp_server_configuration.id
    ]

    affected_bundles = [
        bundle
        for bundle in dummy_mcp_server_bundles
        if bundle.user_id == dummy_user.id
        and dummy_mcp_server_configuration.id in bundle.mcp_server_configuration_ids
    ]

    for affected_connected_account in affected_connected_accounts:
        db_account_record = crud.connected_accounts.get_connected_account_by_id(
            db_session=db_session, connected_account_id=affected_connected_account.id
        )
        if has_stale:
            assert db_account_record is None
        else:
            assert db_account_record is not None

    for affected_bundle in affected_bundles:
        db_bundle_record = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
            db_session=db_session, mcp_server_bundle_id=affected_bundle.id
        )
        assert db_bundle_record is not None
        if has_stale:
            assert (
                dummy_mcp_server_configuration.id
                not in db_bundle_record.mcp_server_configuration_ids
            )
        else:
            assert (
                dummy_mcp_server_configuration.id in db_bundle_record.mcp_server_configuration_ids
            )


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
    dummy_connected_accounts: list[ConnectedAccount],
    dummy_mcp_server_bundles: list[MCPServerBundle],
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # Double check that originally there are associated ConnectedAccount
    stale_connected_accounts = (
        crud.connected_accounts.get_connected_accounts_by_mcp_server_configuration_id(
            db_session=db_session,
            mcp_server_configuration_id=dummy_mcp_server_configuration.id,
        )
    )
    assert len(stale_connected_accounts) > 0

    # Double check that originally there are associated MCPServerBundle
    stale_bundles = crud.mcp_server_bundles.get_mcp_server_bundles_by_organization_id_and_contains_mcp_server_configuration_id(  # noqa: E501
        db_session=db_session,
        organization_id=dummy_mcp_server_configuration.organization_id,
        mcp_server_configuration_id=dummy_mcp_server_configuration.id,
    )
    assert len(stale_bundles) > 0

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

        # Check if the associated ConnectedAccount is deleted
        stale_connected_accounts = (
            crud.connected_accounts.get_connected_accounts_by_mcp_server_configuration_id(
                db_session=db_session,
                mcp_server_configuration_id=dummy_mcp_server_configuration.id,
            )
        )
        assert len(stale_connected_accounts) == 0

        # Check if it is also removed from any associated MCPServerBundle
        stale_bundles = crud.mcp_server_bundles.get_mcp_server_bundles_by_organization_id_and_contains_mcp_server_configuration_id(  # noqa: E501
            db_session=db_session,
            organization_id=dummy_mcp_server_configuration.organization_id,
            mcp_server_configuration_id=dummy_mcp_server_configuration.id,
        )
        assert len(stale_bundles) == 0

    else:
        # Should not be able to delete the MCP server configuration
        assert response.status_code == 403


class TestOperationalMCPServerConfiguration:
    @pytest.mark.parametrize("is_operational", [True, False])
    def test_update_operational_mcp_server_configuration(
        self,
        dummy_access_token_admin: str,
        test_client: TestClient,
        db_session: Session,
        dummy_mcp_server_configuration: MCPServerConfiguration,
        is_operational: bool,
    ) -> None:
        dummy_mcp_server_configuration.connected_account_ownership = (
            ConnectedAccountOwnership.OPERATIONAL
            if is_operational
            else ConnectedAccountOwnership.SHARED
        )
        db_session.commit()

        response = test_client.patch(
            f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}/{dummy_mcp_server_configuration.id}",
            headers={"Authorization": f"Bearer {dummy_access_token_admin}"},
            json={"allowed_teams": []},
        )

        if is_operational:
            assert response.status_code == 403
            assert response.json()["error"].endswith(
                "Cannot update a MCPServerConfiguration of operational type"
            )
        else:
            assert response.status_code == 200

    @pytest.mark.parametrize("is_operational", [True, False])
    def test_delete_operational_mcp_server_configuration(
        self,
        dummy_access_token_admin: str,
        test_client: TestClient,
        db_session: Session,
        dummy_mcp_server_configuration: MCPServerConfiguration,
        is_operational: bool,
    ) -> None:
        dummy_mcp_server_configuration.connected_account_ownership = (
            ConnectedAccountOwnership.OPERATIONAL
            if is_operational
            else ConnectedAccountOwnership.SHARED
        )
        db_session.commit()

        response = test_client.delete(
            f"{config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS}/{dummy_mcp_server_configuration.id}",
            headers={"Authorization": f"Bearer {dummy_access_token_admin}"},
        )

        if is_operational:
            assert response.status_code == 403
            assert response.json()["error"].endswith(
                "Cannot delete a MCPServerConfiguration of operational type"
            )
        else:
            assert response.status_code == 200

    @pytest.mark.parametrize("is_operational", [True, False])
    def test_create_operational_mcp_server_configuration(
        self,
        dummy_access_token_admin: str,
        test_client: TestClient,
        db_session: Session,
        is_operational: bool,
        dummy_mcp_server: MCPServer,
    ) -> None:
        db_session.commit()

        body = MCPServerConfigurationCreate(
            name="New MCP Server Configuration",
            description="New MCP Server Configuration Description",
            mcp_server_id=dummy_mcp_server.id,
            auth_type=dummy_mcp_server.auth_configs[0]["type"],
            connected_account_ownership=ConnectedAccountOwnership.OPERATIONAL
            if is_operational
            else ConnectedAccountOwnership.SHARED,
        )

        response = test_client.post(
            config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS,
            headers={"Authorization": f"Bearer {dummy_access_token_admin}"},
            json=body.model_dump(mode="json"),
        )

        if is_operational:
            assert response.status_code == 403
            assert response.json()["error"].endswith(
                "Cannot create a MCPServerConfiguration of operational type"
            )
        else:
            assert response.status_code == 200
