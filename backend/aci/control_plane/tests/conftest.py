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


# ------------------------------------------------------------
#
# Test Clients
#
# ------------------------------------------------------------
@pytest.fixture(scope="function")
def test_client(
    test_client_admin: TestClient, test_client_member: TestClient
) -> Generator[TestClient, None, None]:
    """
    Alias for test_client_admin
    """
    yield test_client_admin


@pytest.fixture(scope="function")
def test_client_admin(
    db_session: Session, dummy_admin: User, dummy_organization: Organization
) -> Generator[TestClient, None, None]:
    """
    Test Client with a admin request context.
    """
    fastapi_app.dependency_overrides[deps.get_request_context] = lambda: deps.RequestContext(
        db_session=db_session,
        user_id=dummy_admin.id,
        act_as=ActAsInfo(
            organization_id=dummy_organization.id,
            role=OrganizationRole.ADMIN,
        ),
    )
    # disable following redirects for testing login
    # NOTE: need to set base_url to http://localhost because we set TrustedHostMiddleware in main.py
    with TestClient(fastapi_app, base_url="http://localhost", follow_redirects=False) as c:
        yield c


@pytest.fixture(scope="function")
def test_client_admin_act_as_member(
    db_session: Session, dummy_admin: User, dummy_organization: Organization
) -> Generator[TestClient, None, None]:
    """
    Test Client with a admin request context but act as a member.
    """
    fastapi_app.dependency_overrides[deps.get_request_context] = lambda: deps.RequestContext(
        db_session=db_session,
        user_id=dummy_admin.id,
        act_as=ActAsInfo(
            organization_id=dummy_organization.id,
            role=OrganizationRole.MEMBER,
        ),
    )
    # disable following redirects for testing login
    # NOTE: need to set base_url to http://localhost because we set TrustedHostMiddleware in main.py
    with TestClient(fastapi_app, base_url="http://localhost", follow_redirects=False) as c:
        yield c


@pytest.fixture(scope="function")
def test_client_member(
    db_session: Session, dummy_member: User, dummy_organization: Organization
) -> Generator[TestClient, None, None]:
    """
    Test Client with a member request context.
    """
    fastapi_app.dependency_overrides[deps.get_request_context] = lambda: deps.RequestContext(
        db_session=db_session,
        user_id=dummy_member.id,
        act_as=ActAsInfo(
            organization_id=dummy_organization.id,
            role=OrganizationRole.MEMBER,
        ),
    )
    with TestClient(fastapi_app, base_url="http://localhost", follow_redirects=False) as c:
        yield c


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
def dummy_organization(db_session: Session) -> Organization:
    dummy_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Organization",
        description="Dummy Organization Description",
    )
    db_session.commit()
    return dummy_organization


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
