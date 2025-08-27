from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db.sql_models import User
from aci.common.enums import OrganizationRole


def test_get_profile(
    test_client: TestClient, dummy_admin: User, dummy_access_token_no_orgs: str
) -> None:
    response = test_client.get(
        "/v1/users/me/profile", headers={"Authorization": f"Bearer {dummy_access_token_no_orgs}"}
    )
    assert response.status_code == 200
    assert response.json() == {
        "user_id": str(dummy_admin.id),
        "name": dummy_admin.name,
        "email": dummy_admin.email,
        "organizations": [
            {
                "organization_id": str(dummy_admin.organization_memberships[0].organization_id),
                "organization_name": dummy_admin.organization_memberships[0].organization.name,
                "role": OrganizationRole.ADMIN,
            }
        ],
    }


def test_get_profile_non_existence_user(
    test_client: TestClient,
    db_session: Session,
    dummy_admin: User,
    dummy_access_token_no_orgs: str,
) -> None:
    # Remove the user
    db_session.query(User).filter(User.id == dummy_admin.id).delete()
    db_session.commit()

    response = test_client.get(
        "/v1/users/me/profile", headers={"Authorization": f"Bearer {dummy_access_token_no_orgs}"}
    )
    print(response.json())
    assert response.status_code == 404
    assert response.json() == {"detail": "User not found"}
