import pytest
from fastapi.testclient import TestClient

from aci.common.db.sql_models import Organization
from aci.common.logging_setup import get_logger
from aci.common.schemas.organizations import CreateOrganizationTeamRequest, TeamInfo

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
def test_create_team(
    request: pytest.FixtureRequest,
    test_client: TestClient,
    access_token_fixture: str,
    dummy_organization: Organization,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    test_input = CreateOrganizationTeamRequest(
        name="Test Team",
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
    else:
        # Check if the team is created
        assert response.status_code == 201
        team_info = TeamInfo.model_validate(response.json())
        assert team_info.name == "Test Team"
        assert team_info.description == "Test Description"
