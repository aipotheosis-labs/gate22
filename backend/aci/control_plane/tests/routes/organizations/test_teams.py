import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import Organization, Team, User
from aci.common.enums import OrganizationRole, UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.organizations import (
    CreateOrganizationTeamRequest,
    TeamInfo,
    TeamMembershipInfo,
)

logger = get_logger(__name__)


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
        "dummy_access_token_non_member",
    ],
)
@pytest.mark.parametrize("duplicate_name", [True, False])
def test_create_team(
    request: pytest.FixtureRequest,
    db_session: Session,
    test_client: TestClient,
    access_token_fixture: str,
    dummy_organization: Organization,
    duplicate_name: bool,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    test_input = CreateOrganizationTeamRequest(
        name="Dummy Team" if duplicate_name else "Test Team",
        description="Test Description",
    )

    response = test_client.post(
        f"/v1/organizations/{dummy_organization.id}/teams",
        json=test_input.model_dump(mode="json"),
        headers={"Authorization": f"Bearer {access_token}"},
    )

    # Only admin can create a team
    if access_token_fixture not in ["dummy_access_token_admin"]:
        assert response.status_code == 403
        return

    if duplicate_name:
        assert response.status_code == 400
        assert response.json()["detail"] == "Team name already exists"
        return

    # Check if the team is created
    assert response.status_code == 201
    team_info = TeamInfo.model_validate(response.json())
    assert team_info.name == test_input.name
    assert team_info.description == test_input.description

    # Check if the team is created in database
    db_team = crud.teams.get_team_by_id(db_session, team_info.team_id)
    assert db_team is not None
    assert db_team.name == test_input.name
    assert db_team.description == test_input.description
    assert len(db_team.memberships) == 0  # No members yet


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
        "dummy_access_token_non_member",
    ],
)
@pytest.mark.parametrize("has_team", [True, False])
def test_list_teams(
    request: pytest.FixtureRequest,
    db_session: Session,
    test_client: TestClient,
    access_token_fixture: str,
    dummy_organization: Organization,
    dummy_team: Team,
    has_team: bool,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    if not has_team:
        # Remove the team
        db_session.query(Team).filter(Team.id == dummy_team.id).delete()
        db_session.commit()

    response = test_client.get(
        f"/v1/organizations/{dummy_organization.id}/teams",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    # Everyone in the org can list team
    if access_token_fixture in ["dummy_access_token_no_orgs", "dummy_access_token_non_member"]:
        assert response.status_code == 403
        return

    assert response.status_code == 200
    team_infos = [TeamInfo.model_validate(team_info) for team_info in response.json()]

    if has_team:
        assert len(team_infos) == 1
        assert team_infos[0].name == dummy_team.name
        assert team_infos[0].description == dummy_team.description
    else:
        assert len(team_infos) == 0


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
        "dummy_access_token_non_member",
    ],
)
@pytest.mark.parametrize("is_self_team", [True, False])
def test_list_team_members(
    request: pytest.FixtureRequest,
    db_session: Session,
    test_client: TestClient,
    access_token_fixture: str,
    dummy_organization: Organization,
    dummy_user: User,
    is_self_team: bool,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # Add a team with a random teammate, then optionally add current user as a team member
    new_team = crud.teams.create_team(
        db_session, dummy_organization.id, "Test Team", "Test Description"
    )
    teammate = crud.users.create_user(
        db_session, "Teammate", "teammate@example.com", None, UserIdentityProvider.EMAIL
    )
    crud.organizations.add_user_to_organization(
        db_session, dummy_organization.id, teammate.id, OrganizationRole.MEMBER
    )
    crud.teams.add_team_member(db_session, dummy_organization.id, new_team.id, teammate.id)

    if is_self_team:
        crud.teams.add_team_member(db_session, dummy_organization.id, new_team.id, dummy_user.id)
    db_session.commit()

    response = test_client.get(
        f"/v1/organizations/{dummy_organization.id}/teams/{new_team.id}/members",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if access_token_fixture in ["dummy_access_token_no_orgs", "dummy_access_token_non_member"]:
        assert response.status_code == 403
        return

    assert response.status_code == 200
    if is_self_team:
        team_members = [
            TeamMembershipInfo.model_validate(team_member) for team_member in response.json()
        ]
        assert teammate.id in [member.user_id for member in team_members]
