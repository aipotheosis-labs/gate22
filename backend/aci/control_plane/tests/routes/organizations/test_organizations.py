from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import User
from aci.common.enums import OrganizationRole
from aci.common.schemas.organizations import CreateOrganizationRequest, OrganizationInfo


def test_create_organization(
    db_session: Session, test_client: TestClient, dummy_user: User, dummy_access_token_no_orgs: str
) -> None:
    test_input = CreateOrganizationRequest(
        name="Test Org",
        description="Test Description",
    )

    response = test_client.post(
        "/v1/organizations",
        json=test_input.model_dump(mode="json"),
        headers={"Authorization": f"Bearer {dummy_access_token_no_orgs}"},
    )
    assert response.status_code == 201
    organization = OrganizationInfo.model_validate(response.json())
    assert organization.name == test_input.name
    assert organization.description == test_input.description

    # Check if organization is created in database
    db_org = crud.organizations.get_organization_by_name(db_session, test_input.name)
    assert db_org is not None
    assert db_org.name == "Test Org"

    # Check if user is added to organization as admin
    organization_membership = crud.organizations.get_organization_membership(
        db_session, organization.organization_id, dummy_user.id
    )
    assert organization_membership is not None
    assert organization_membership.user_id == dummy_user.id
    assert organization_membership.role == OrganizationRole.ADMIN
