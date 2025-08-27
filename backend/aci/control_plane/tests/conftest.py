from collections.abc import Generator
from typing import cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Inspector, inspect
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import Base, Organization, User
from aci.common.enums import OrganizationRole, UserIdentityProvider
from aci.common.schemas.auth import ActAsInfo
from aci.common.test_utils import clear_database, create_test_db_session
from aci.control_plane import dependencies as deps
from aci.control_plane.main import app as fastapi_app
from aci.control_plane.routes.auth import _sign_token


@pytest.fixture(scope="function")
def test_client(db_session: Session) -> Generator[TestClient, None, None]:
    fastapi_app.dependency_overrides[deps.get_request_context] = lambda: db_session
    # disable following redirects for testing login
    # NOTE: need to set base_url to http://localhost because we set TrustedHostMiddleware in main.py
    with TestClient(fastapi_app, base_url="http://localhost", follow_redirects=False) as c:
        yield c


# ------------------------------------------------------------
# Dummy Access Tokens for testing
# - dummy_access_token_admin
# - dummy_access_token_admin_act_as_member
# - dummy_access_token_member
# - dummy_access_token_no_orgs (without act as)
# ------------------------------------------------------------
@pytest.fixture(scope="function")
def dummy_access_token_admin(dummy_admin: User) -> str:
    org_membership = dummy_admin.organization_memberships[0]
    return _sign_token(
        dummy_admin,
        ActAsInfo(organization_id=org_membership.organization_id, role=OrganizationRole.ADMIN),
    )


@pytest.fixture(scope="function")
def dummy_access_token_admin_act_as_member(dummy_admin: User) -> str:
    org_membership = dummy_admin.organization_memberships[0]
    return _sign_token(
        dummy_admin,
        ActAsInfo(organization_id=org_membership.organization_id, role=OrganizationRole.MEMBER),
    )


@pytest.fixture(scope="function")
def dummy_access_token_member(dummy_member: User) -> str:
    org_membership = dummy_member.organization_memberships[0]
    return _sign_token(
        dummy_member,
        ActAsInfo(organization_id=org_membership.organization_id, role=OrganizationRole.MEMBER),
    )


@pytest.fixture(scope="function")
def dummy_access_token_no_orgs(dummy_user: User) -> str:
    return _sign_token(dummy_user, None)


# ------------------------------------------------------------
# Dummy organization and user
# - dummy_organization
# - dummy_user
# - dummy_admin (added to the dummy_organization as admin)
# - dummy_member (added to the dummy_organization as member)
# ------------------------------------------------------------


@pytest.fixture(scope="function")
def dummy_organization(db_session: Session) -> Organization:
    dummy_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Organization",
        description="Dummy Organization Description",
    )
    db_session.commit()
    return dummy_organization


@pytest.fixture(scope="function")
def dummy_user(db_session: Session, database_setup_and_cleanup: None) -> User:
    dummy_user = crud.users.create_user(
        db_session=db_session,
        name="Dummy User",
        email="dummy1@example.com",
        password_hash=None,
        identity_provider=UserIdentityProvider.EMAIL,
    )
    db_session.commit()
    return dummy_user


@pytest.fixture(scope="function")
def dummy_admin(db_session: Session, dummy_user: User, dummy_organization: Organization) -> User:
    crud.organizations.add_user_to_organization(
        db_session=db_session,
        organization_id=dummy_organization.id,
        user_id=dummy_user.id,
        role=OrganizationRole.ADMIN,
    )
    db_session.commit()
    return dummy_user


@pytest.fixture(scope="function")
def dummy_member(db_session: Session, dummy_user: User, dummy_organization: Organization) -> User:
    crud.organizations.add_user_to_organization(
        db_session=db_session,
        organization_id=dummy_organization.id,
        user_id=dummy_user.id,
        role=OrganizationRole.MEMBER,
    )
    db_session.commit()
    return dummy_user


# ------------------------------------------------------------
#
# Database session setup and cleanup
#
# ------------------------------------------------------------
@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    yield from create_test_db_session()


@pytest.fixture(scope="function", autouse=True)
def database_setup_and_cleanup(db_session: Session) -> Generator[None, None, None]:
    """
    Setup and cleanup the database for each test case.
    """
    inspector = cast(Inspector, inspect(db_session.bind))

    # Check if all tables defined in models are created in the db
    for table in Base.metadata.tables.values():
        if not inspector.has_table(table.name):
            pytest.exit(f"Table {table} does not exist in the database.")

    clear_database(db_session)
    yield  # This allows the test to run
    clear_database(db_session)
