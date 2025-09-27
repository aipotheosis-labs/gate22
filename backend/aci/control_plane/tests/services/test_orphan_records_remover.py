import enum
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import (
    MCPServerConfiguration,
    Organization,
    Team,
    User,
)
from aci.common.enums import ConnectedAccountOwnership
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server_bundle import MCPServerBundleCreate
from aci.control_plane import access_control
from aci.control_plane.services.orphan_records_remover import (
    OrphanRecordsRemoval,
    OrphanRecordsRemover,
)

logger = get_logger(__name__)


def _create_team_with_members(
    db_session: Session, organization_id: UUID, user_ids: list[UUID]
) -> Team:
    random_name = f"Team {uuid4()}"
    team = crud.teams.create_team(
        db_session=db_session,
        organization_id=organization_id,
        name=f"Team {random_name}",
        description="Team Description",
    )
    for user_id in user_ids:
        crud.teams.add_team_member(
            db_session=db_session,
            organization_id=organization_id,
            team_id=team.id,
            user_id=user_id,
        )
    db_session.commit()
    return team


def _assert_users_configuration_accessibilities(
    db_session: Session,
    accessibilities: list[tuple[UUID, UUID, bool]],
) -> None:
    for user_id, mcp_server_configuration_id, accessibility in accessibilities:
        assert (
            access_control.check_mcp_server_config_accessibility(
                db_session=db_session,
                user_id=user_id,
                mcp_server_configuration_id=mcp_server_configuration_id,
                throw_error_if_not_permitted=False,
            )
            is accessibility
        )


def _assert_connected_accounts_removal(
    db_session: Session,
    removal_result: OrphanRecordsRemoval,
    expected_removed_connected_accounts: list[UUID],
    expected_retained_connected_accounts: list[UUID],
) -> None:
    for connected_account_id in expected_removed_connected_accounts:
        assert (
            crud.connected_accounts.get_connected_account_by_id(
                db_session=db_session,
                connected_account_id=connected_account_id,
            )
            is None
        )
    for connected_account_id in expected_retained_connected_accounts:
        assert (
            crud.connected_accounts.get_connected_account_by_id(
                db_session=db_session,
                connected_account_id=connected_account_id,
            )
            is not None
        )
    assert removal_result.connected_accounts is not None
    assert [a.id for a in removal_result.connected_accounts] == expected_removed_connected_accounts
    assert [a.id for a in removal_result.connected_accounts] != expected_retained_connected_accounts


def _assert_mcp_configurations_in_bundles_removal(
    db_session: Session,
    removal_result: OrphanRecordsRemoval,
    expected_removed_mcp_configurations_in_bundles: list[
        tuple[UUID, list[UUID]]
    ],  # list of (bundle_id, configuration_ids)[]
    expected_retained_mcp_configurations_in_bundles: list[
        tuple[UUID, list[UUID]]
    ],  # list of (bundle_id, configuration_ids)[]
) -> None:
    for bundle_id, configuration_ids in expected_removed_mcp_configurations_in_bundles:
        bundle = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
            db_session=db_session,
            mcp_server_bundle_id=bundle_id,
        )
        assert bundle is not None
        for configuration_id in configuration_ids:
            assert configuration_id not in bundle.mcp_server_configuration_ids

    for bundle_id, configuration_ids in expected_retained_mcp_configurations_in_bundles:
        bundle = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
            db_session=db_session,
            mcp_server_bundle_id=bundle_id,
        )
        assert bundle is not None
        for configuration_id in configuration_ids:
            assert configuration_id in bundle.mcp_server_configuration_ids

    assert removal_result.mcp_configurations_in_bundles is not None

    for bundle_id, configuration_ids in expected_removed_mcp_configurations_in_bundles:
        for configuration_id in configuration_ids:
            assert (bundle_id, configuration_id) in [
                (a.bundle_id, a.configuration_id)
                for a in removal_result.mcp_configurations_in_bundles
            ]
    for bundle_id, configuration_ids in expected_retained_mcp_configurations_in_bundles:
        for configuration_id in configuration_ids:
            assert (bundle_id, configuration_id) not in [
                (a.bundle_id, a.configuration_id)
                for a in removal_result.mcp_configurations_in_bundles
            ]


@pytest.fixture(scope="function")
def dummy_base_configuration_with_multi_teams(
    db_session: Session,
    dummy_organization: Organization,
    dummy_user: User,
    dummy_user_2: User,
    dummy_mcp_server_configuration: MCPServerConfiguration,
) -> MCPServerConfiguration:
    """
    Connection Visualization:
    ┌─────────────────────────────────────────────┐
    │ dummy_mcp_server_configuration (individual) │
    └─────────────────────────────────────────────┘
        │
    (allowed_teams)       ┌─────────────┐
        │              ┌─>│ dummy_user  │
        ├──> team_1 ───┤  └─────────────┘
        │              │
        │              └─>┌──────────────┐
        └──> team_2 ─────>│ dummy_user_2 │
                          └──────────────┘
    """

    team_1 = _create_team_with_members(
        db_session, dummy_organization.id, [dummy_user.id, dummy_user_2.id]
    )
    team_2 = _create_team_with_members(db_session, dummy_organization.id, [dummy_user_2.id])
    dummy_mcp_server_configuration.allowed_teams = [team_1.id, team_2.id]

    dummy_mcp_server_configuration.connected_account_ownership = (
        ConnectedAccountOwnership.INDIVIDUAL
    )

    db_session.commit()
    return dummy_mcp_server_configuration


OrphanConnectedAccountTestCase = enum.Enum(
    "OrphanConnectedAccountTestCase",
    [
        "remove_none",
        "remove_team_1",
        "remove_team_2",
        "remove_all",
    ],
)


@pytest.mark.parametrize(
    "connected_account_case, removed_connected_accounts_names",
    [
        (OrphanConnectedAccountTestCase.remove_none, []),
        (OrphanConnectedAccountTestCase.remove_team_1, ["connected_account_user"]),
        (OrphanConnectedAccountTestCase.remove_team_2, []),
        (
            OrphanConnectedAccountTestCase.remove_all,
            ["connected_account_user", "connected_account_user_2"],
        ),
    ],
)
def test_on_mcp_server_configuration_allowed_teams_updated(
    db_session: Session,
    dummy_organization: Organization,
    dummy_user: User,
    dummy_user_2: User,
    connected_account_case: OrphanConnectedAccountTestCase,
    removed_connected_accounts_names: list[str],
    dummy_base_configuration_with_multi_teams: MCPServerConfiguration,
) -> None:
    # Confirm the users are accessible to the MCP Server Configuration originally
    _assert_users_configuration_accessibilities(
        db_session=db_session,
        accessibilities=[
            (dummy_user.id, dummy_base_configuration_with_multi_teams.id, True),
            (dummy_user_2.id, dummy_base_configuration_with_multi_teams.id, True),
        ],
    )

    # Create connected accounts for both users
    connected_account_user = crud.connected_accounts.create_connected_account(
        db_session=db_session,
        user_id=dummy_user.id,
        mcp_server_configuration_id=dummy_base_configuration_with_multi_teams.id,
        auth_credentials={},
        ownership=ConnectedAccountOwnership.INDIVIDUAL,
    )
    connected_account_user_2 = crud.connected_accounts.create_connected_account(
        db_session=db_session,
        user_id=dummy_user_2.id,
        mcp_server_configuration_id=dummy_base_configuration_with_multi_teams.id,
        auth_credentials={},
        ownership=ConnectedAccountOwnership.INDIVIDUAL,
    )

    # Create Bundles for both users, both contains the same MCP Server Configuration
    bundle_user = crud.mcp_server_bundles.create_mcp_server_bundle(
        db_session=db_session,
        user_id=dummy_user.id,
        organization_id=dummy_organization.id,
        mcp_server_bundle_create=MCPServerBundleCreate(
            name="Test Bundle 1",
            description="Test Bundle 1 Description",
            mcp_server_configuration_ids=[
                dummy_base_configuration_with_multi_teams.id,
                uuid4(),
                uuid4(),
            ],
        ),
        bundle_key="test_bundle_1_key",
    )
    bundle_user_2 = crud.mcp_server_bundles.create_mcp_server_bundle(
        db_session=db_session,
        user_id=dummy_user_2.id,
        organization_id=dummy_organization.id,
        mcp_server_bundle_create=MCPServerBundleCreate(
            name="Test Bundle 2",
            description="Test Bundle 2 Description",
            mcp_server_configuration_ids=[
                dummy_base_configuration_with_multi_teams.id,
                uuid4(),
            ],
        ),
        bundle_key="test_bundle_2_key",
    )

    db_session.commit()

    # Now remove teams based on the test parameter
    team_1 = dummy_base_configuration_with_multi_teams.allowed_teams[0]
    team_2 = dummy_base_configuration_with_multi_teams.allowed_teams[1]

    match connected_account_case:
        case OrphanConnectedAccountTestCase.remove_none:
            pass  # no change
        case OrphanConnectedAccountTestCase.remove_team_1:
            dummy_base_configuration_with_multi_teams.allowed_teams = [team_2]
        case OrphanConnectedAccountTestCase.remove_team_2:
            dummy_base_configuration_with_multi_teams.allowed_teams = [team_1]
        case OrphanConnectedAccountTestCase.remove_all:
            dummy_base_configuration_with_multi_teams.allowed_teams = []

    # Execute the orphan records removal
    removal_result = OrphanRecordsRemover(
        db_session
    ).on_mcp_server_configuration_allowed_teams_updated(
        mcp_server_configuration=dummy_base_configuration_with_multi_teams
    )

    db_session.commit()

    # Verify the results
    match connected_account_case:
        case OrphanConnectedAccountTestCase.remove_none:
            # No connected account should be removed because there is no change
            _assert_connected_accounts_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_connected_accounts=[],
                expected_retained_connected_accounts=[
                    connected_account_user.id,
                    connected_account_user_2.id,
                ],
            )
            _assert_mcp_configurations_in_bundles_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_mcp_configurations_in_bundles=[],
                expected_retained_mcp_configurations_in_bundles=[
                    (bundle_user.id, [dummy_base_configuration_with_multi_teams.id]),
                    (bundle_user_2.id, [dummy_base_configuration_with_multi_teams.id]),
                ],
            )

        case OrphanConnectedAccountTestCase.remove_team_1:
            # dummy_user's connected account should be removed
            # dummy_user_2's still accessible via team_2
            _assert_connected_accounts_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_connected_accounts=[connected_account_user.id],
                expected_retained_connected_accounts=[connected_account_user_2.id],
            )

            # configuration in dummy_user's bundle should be removed
            # configuration in dummy_user_2's bundle should still be accessible
            _assert_mcp_configurations_in_bundles_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_mcp_configurations_in_bundles=[
                    (bundle_user.id, [dummy_base_configuration_with_multi_teams.id]),
                    (bundle_user_2.id, []),
                ],
                expected_retained_mcp_configurations_in_bundles=[
                    (bundle_user.id, []),
                    (bundle_user_2.id, [dummy_base_configuration_with_multi_teams.id]),
                ],
            )

        case OrphanConnectedAccountTestCase.remove_team_2:
            # No connected account should be removed, both users are still accessible via team_1
            _assert_connected_accounts_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_connected_accounts=[],
                expected_retained_connected_accounts=[
                    connected_account_user.id,
                    connected_account_user_2.id,
                ],
            )
            _assert_mcp_configurations_in_bundles_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_mcp_configurations_in_bundles=[
                    (bundle_user.id, []),
                    (bundle_user_2.id, []),
                ],
                expected_retained_mcp_configurations_in_bundles=[
                    (bundle_user.id, [dummy_base_configuration_with_multi_teams.id]),
                    (bundle_user_2.id, [dummy_base_configuration_with_multi_teams.id]),
                ],
            )

        case OrphanConnectedAccountTestCase.remove_all:
            # Both users' connected accounts should be removed
            _assert_connected_accounts_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_connected_accounts=[
                    connected_account_user.id,
                    connected_account_user_2.id,
                ],
                expected_retained_connected_accounts=[],
            )
            _assert_mcp_configurations_in_bundles_removal(
                db_session=db_session,
                removal_result=removal_result,
                expected_removed_mcp_configurations_in_bundles=[
                    (bundle_user.id, [dummy_base_configuration_with_multi_teams.id]),
                    (bundle_user_2.id, [dummy_base_configuration_with_multi_teams.id]),
                ],
                expected_retained_mcp_configurations_in_bundles=[
                    (bundle_user.id, []),
                    (bundle_user_2.id, []),
                ],
            )


def test_on_mcp_server_configuration_deleted(
    db_session: Session,
    dummy_organization: Organization,
    dummy_user: User,
    dummy_user_2: User,
    dummy_base_configuration_with_multi_teams: MCPServerConfiguration,
) -> None:
    # Create connected accounts for both users
    connected_account_user = crud.connected_accounts.create_connected_account(
        db_session=db_session,
        user_id=dummy_user.id,
        mcp_server_configuration_id=dummy_base_configuration_with_multi_teams.id,
        auth_credentials={},
        ownership=ConnectedAccountOwnership.INDIVIDUAL,
    )
    connected_account_user_2 = crud.connected_accounts.create_connected_account(
        db_session=db_session,
        user_id=dummy_user_2.id,
        mcp_server_configuration_id=dummy_base_configuration_with_multi_teams.id,
        auth_credentials={},
        ownership=ConnectedAccountOwnership.INDIVIDUAL,
    )

    original_ids = [connected_account_user.id, connected_account_user_2.id]

    # Create Bundles for both users, both contains the same MCP Server Configuration
    bundle_user = crud.mcp_server_bundles.create_mcp_server_bundle(
        db_session=db_session,
        user_id=dummy_user.id,
        organization_id=dummy_organization.id,
        mcp_server_bundle_create=MCPServerBundleCreate(
            name="Test Bundle 1",
            description="Test Bundle 1 Description",
            mcp_server_configuration_ids=[
                dummy_base_configuration_with_multi_teams.id,
                uuid4(),
                uuid4(),
            ],
        ),
        bundle_key="test_bundle_1_key",
    )
    bundle_user_2 = crud.mcp_server_bundles.create_mcp_server_bundle(
        db_session=db_session,
        user_id=dummy_user_2.id,
        organization_id=dummy_organization.id,
        mcp_server_bundle_create=MCPServerBundleCreate(
            name="Test Bundle 2",
            description="Test Bundle 2 Description",
            mcp_server_configuration_ids=[
                dummy_base_configuration_with_multi_teams.id,
                uuid4(),
            ],
        ),
        bundle_key="test_bundle_2_key",
    )

    db_session.commit()

    # Now delete the MCP Server Configuration
    crud.mcp_server_configurations.delete_mcp_server_configuration(
        db_session=db_session,
        mcp_server_configuration_id=dummy_base_configuration_with_multi_teams.id,
    )

    # Execute the orphan records removal
    removal_result = OrphanRecordsRemover(db_session).on_mcp_server_configuration_deleted(
        organization_id=dummy_organization.id,
        mcp_server_configuration_id=dummy_base_configuration_with_multi_teams.id,
    )

    db_session.commit()

    # Verify the results
    # All connected accounts should be deleted. This is done automatically by the CASCADE DELETE
    # during the MCP Server Configuration deletion, instead of deleted by the
    # OrphanRecordsRemover. So it is not returned in the removal result.
    for connected_account_id in original_ids:
        assert (
            crud.connected_accounts.get_connected_account_by_id(
                db_session=db_session,
                connected_account_id=connected_account_id,
            )
            is None
        )

    _assert_mcp_configurations_in_bundles_removal(
        db_session=db_session,
        removal_result=removal_result,
        expected_removed_mcp_configurations_in_bundles=[
            (bundle_user.id, [dummy_base_configuration_with_multi_teams.id]),
            (bundle_user_2.id, [dummy_base_configuration_with_multi_teams.id]),
        ],
        expected_retained_mcp_configurations_in_bundles=[
            (bundle_user.id, []),
            (bundle_user_2.id, []),
        ],
    )
