from collections.abc import Generator
from typing import cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Inspector, inspect
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import (
    Base,
    ConnectedAccount,
    MCPServer,
    MCPServerBundle,
    MCPServerConfiguration,
    Organization,
    Team,
    User,
)
from aci.common.enums import OrganizationRole, UserIdentityProvider
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import ActAsInfo
from aci.common.schemas.mcp_server_bundle import MCPServerBundleCreate
from aci.common.schemas.mcp_server_configuration import MCPServerConfigurationCreate
from aci.common.test_utils import clear_database, create_test_db_session
from aci.control_plane import dependencies as deps
from aci.control_plane.main import app as fastapi_app
from aci.control_plane.routes.auth import _sign_token
from aci.control_plane.tests import helper

logger = get_logger(__name__)


# call this one time for entire tests because it's slow and costs money (negligible) as it needs
# to generate embeddings using OpenAI for each app and function
dummy_mcp_servers_to_be_inserted = helper.prepare_mcp_servers()
DUMMY_MCP_SERVER_NAME_NOTION = "NOTION"
DUMMY_MCP_SERVER_NAME_GITHUB = "GITHUB"


@pytest.fixture(scope="function")
def test_client(db_session: Session) -> Generator[TestClient, None, None]:
    fastapi_app.dependency_overrides[deps.yield_db_session] = lambda: db_session
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
# - dummy_access_token_another_org (act as other organization)
# ------------------------------------------------------------
@pytest.fixture(scope="function")
def dummy_access_token_admin(dummy_admin: User) -> str:
    """
    Access token of `dummy_user` with `admin` role in `dummy_organization`
    """
    org_membership = dummy_admin.organization_memberships[0]
    return _sign_token(
        dummy_admin,
        ActAsInfo(organization_id=org_membership.organization_id, role=OrganizationRole.ADMIN),
    )


@pytest.fixture(scope="function")
def dummy_access_token_admin_act_as_member(dummy_admin: User) -> str:
    """
    Access token of `dummy_user` with `admin` role in `dummy_organization`, but act as `member` role
    """
    org_membership = dummy_admin.organization_memberships[0]
    return _sign_token(
        dummy_admin,
        ActAsInfo(organization_id=org_membership.organization_id, role=OrganizationRole.MEMBER),
    )


@pytest.fixture(scope="function")
def dummy_access_token_member(dummy_member: User) -> str:
    """
    Access token of `dummy_user` with `member` role in `dummy_organization`
    """
    org_membership = dummy_member.organization_memberships[0]
    return _sign_token(
        dummy_member,
        ActAsInfo(organization_id=org_membership.organization_id, role=OrganizationRole.MEMBER),
    )


@pytest.fixture(scope="function")
def dummy_access_token_no_orgs(dummy_user_without_org: User) -> str:
    """
    Access token of a user without any organization
    """
    return _sign_token(dummy_user_without_org, None)


@pytest.fixture(scope="function")
def dummy_access_token_another_org(db_session: Session) -> str:
    """
    Access token of a user acted as other organization. This user has no membership in
    `dummy_organization`.
    """
    dummy_other_user = crud.users.create_user(
        db_session=db_session,
        name="Dummy Other User",
        email="dummy_other@example.com",
        password_hash=None,
        identity_provider=UserIdentityProvider.EMAIL,
    )

    dummy_other_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Other Organization",
        description="Dummy Other Organization Description",
    )

    crud.organizations.add_user_to_organization(
        db_session=db_session,
        organization_id=dummy_other_organization.id,
        user_id=dummy_other_user.id,
        role=OrganizationRole.ADMIN,
    )
    db_session.commit()

    return _sign_token(
        dummy_other_user,
        ActAsInfo(organization_id=dummy_other_organization.id, role=OrganizationRole.ADMIN),
    )


# ------------------------------------------------------------
# Dummy organization and user
# - dummy_user
# - dummy_organization (with dummy_user as org admin, and a dummy team with dummy_user inside)
# - dummy_admin (added to the dummy_organization as admin)
# - dummy_member (added to the dummy_organization as member)
# ------------------------------------------------------------


@pytest.fixture(scope="function")
def dummy_organization(db_session: Session, database_setup_and_cleanup: None) -> Organization:
    dummy_organization = crud.organizations.create_organization(
        db_session=db_session,
        name="Dummy Organization",
        description="Dummy Organization Description",
    )
    dummy_user = crud.users.create_user(
        db_session=db_session,
        name="Dummy User",
        email="dummy@example.com",
        password_hash=None,
        identity_provider=UserIdentityProvider.EMAIL,
    )
    crud.organizations.add_user_to_organization(
        db_session=db_session,
        organization_id=dummy_organization.id,
        user_id=dummy_user.id,
        role=OrganizationRole.ADMIN,
    )
    dummy_team = crud.teams.create_team(
        db_session=db_session,
        organization_id=dummy_organization.id,
        name="Dummy Team",
        description="Dummy Team Description",
    )
    crud.teams.add_team_member(
        db_session=db_session,
        organization_id=dummy_organization.id,
        team_id=dummy_team.id,
        user_id=dummy_user.id,
    )
    db_session.commit()
    return dummy_organization


@pytest.fixture(scope="function")
def dummy_user(dummy_organization: Organization) -> User:
    """
    `dummy_user` with in `dummy_organization`
    """
    dummy_user = dummy_organization.memberships[0].user
    return dummy_user


@pytest.fixture(scope="function")
def dummy_admin(dummy_organization: Organization) -> User:
    """
    `dummy_user` with `admin` role in `dummy_organization`
    """
    return dummy_organization.memberships[0].user


@pytest.fixture(scope="function")
def dummy_member(db_session: Session, dummy_organization: Organization) -> User:
    """
    `dummy_user` with `member` role in `dummy_organization`
    """
    membership = dummy_organization.memberships[0]
    membership.role = OrganizationRole.MEMBER
    db_session.commit()
    return membership.user


@pytest.fixture(scope="function")
def dummy_another_org_member(db_session: Session, dummy_organization: Organization) -> User:
    """
    This will add another member into dummy_organization.
    """
    dummy_another_user = crud.users.create_user(
        db_session=db_session,
        name="Dummy Another User",
        email="dummy_another@example.com",
        password_hash=None,
        identity_provider=UserIdentityProvider.EMAIL,
    )
    crud.organizations.add_user_to_organization(
        db_session=db_session,
        organization_id=dummy_organization.id,
        user_id=dummy_another_user.id,
        role=OrganizationRole.MEMBER,
    )
    return dummy_another_user


@pytest.fixture(scope="function")
def dummy_team(dummy_organization: Organization) -> Team:
    return dummy_organization.teams[0]


@pytest.fixture(scope="function")
def dummy_user_without_org(db_session: Session) -> User:
    user = crud.users.create_user(
        db_session=db_session,
        name="Dummy User Without Org",
        email="dummy_without_org@example.com",
        password_hash=None,
        identity_provider=UserIdentityProvider.EMAIL,
    )
    return user


# ------------------------------------------------------------
#
# Dummy MCP Servers
#
# ------------------------------------------------------------


@pytest.fixture(scope="function")
def dummy_mcp_servers(db_session: Session) -> list[MCPServer]:
    dummy_mcp_servers = []
    for (
        mcp_server_upsert,
        tools_upsert,
        embedding,
        mcp_tool_embeddings,
    ) in dummy_mcp_servers_to_be_inserted:
        mcp_server = crud.mcp_servers.create_mcp_server(
            db_session=db_session, mcp_server_upsert=mcp_server_upsert, embedding=embedding
        )
        crud.mcp_tools.create_mcp_tools(
            db_session=db_session,
            mcp_tool_upserts=tools_upsert,
            mcp_tool_embeddings=mcp_tool_embeddings,
        )
        dummy_mcp_servers.append(mcp_server)
        db_session.commit()
    return dummy_mcp_servers


@pytest.fixture(scope="function")
def dummy_mcp_server_notion(dummy_mcp_servers: list[MCPServer]) -> MCPServer:
    dummy_mcp_server_notion = next(
        dummy_mcp_server
        for dummy_mcp_server in dummy_mcp_servers
        if dummy_mcp_server.name == DUMMY_MCP_SERVER_NAME_NOTION
    )
    assert dummy_mcp_server_notion is not None
    return dummy_mcp_server_notion


@pytest.fixture(scope="function")
def dummy_mcp_server_github(dummy_mcp_servers: list[MCPServer]) -> MCPServer:
    dummy_mcp_server_notion = next(
        dummy_mcp_server
        for dummy_mcp_server in dummy_mcp_servers
        if dummy_mcp_server.name == DUMMY_MCP_SERVER_NAME_GITHUB
    )
    assert dummy_mcp_server_notion is not None
    return dummy_mcp_server_notion


@pytest.fixture(scope="function")
def dummy_mcp_server(dummy_mcp_server_notion: MCPServer) -> MCPServer:
    """
    alias for dummy_mcp_server_notion
    """
    return dummy_mcp_server_notion


# ------------------------------------------------------------
#
# Dummy MCP Servers Configurations
#
# ------------------------------------------------------------


@pytest.fixture(scope="function")
def dummy_mcp_server_configurations(
    db_session: Session,
    dummy_organization: Organization,
    dummy_mcp_servers: list[MCPServer],
) -> list[MCPServerConfiguration]:
    dummy_mcp_server_configurations = []
    for dummy_mcp_server in dummy_mcp_servers:
        dummy_mcp_server_configuration = (
            crud.mcp_server_configurations.create_mcp_server_configuration(
                db_session=db_session,
                organization_id=dummy_organization.id,
                mcp_server_configuration=MCPServerConfigurationCreate(
                    mcp_server_id=dummy_mcp_server.id,
                    auth_type=dummy_mcp_server.auth_configs[0]["type"],
                    all_tools_enabled=True,
                    enabled_tools=[],
                    allowed_teams=[],
                ),
            )
        )
        dummy_mcp_server_configurations.append(dummy_mcp_server_configuration)
    return dummy_mcp_server_configurations


@pytest.fixture(scope="function")
def dummy_mcp_server_configuration(
    dummy_mcp_server_configuration_notion: MCPServerConfiguration,
) -> MCPServerConfiguration:
    """
    alias for dummy_mcp_server_configuration_notion
    """
    return dummy_mcp_server_configuration_notion


@pytest.fixture(scope="function")
def dummy_mcp_server_configuration_notion(
    dummy_mcp_server_configurations: list[MCPServerConfiguration],
    dummy_mcp_server_notion: MCPServer,
) -> MCPServerConfiguration:
    """
    A dummy MCP server configuration under dummy_organization, allowed [dummy_team]
    """
    dummy_mcp_server_configuration = next(
        dummy_mcp_server_configuration
        for dummy_mcp_server_configuration in dummy_mcp_server_configurations
        if dummy_mcp_server_configuration.mcp_server_id == dummy_mcp_server_notion.id
    )
    assert dummy_mcp_server_configuration is not None
    return dummy_mcp_server_configuration


@pytest.fixture(scope="function")
def dummy_mcp_server_configuration_github(
    dummy_mcp_server_configurations: list[MCPServerConfiguration],
    dummy_mcp_server_github: MCPServer,
) -> MCPServerConfiguration:
    dummy_mcp_server_configuration = next(
        dummy_mcp_server_configuration
        for dummy_mcp_server_configuration in dummy_mcp_server_configurations
        if dummy_mcp_server_configuration.mcp_server_id == dummy_mcp_server_github.id
    )
    assert dummy_mcp_server_configuration is not None
    return dummy_mcp_server_configuration


# ------------------------------------------------------------
#
# Dummy Connected Accounts
#
# ------------------------------------------------------------


@pytest.fixture(scope="function")
def dummy_connected_accounts(
    db_session: Session,
    dummy_user: User,
    dummy_another_org_member: User,
    dummy_mcp_server_configuration_github: MCPServerConfiguration,
    dummy_mcp_server_configuration_notion: MCPServerConfiguration,
) -> list[ConnectedAccount]:
    """
    Test settings:
    - dummy_user connected to dummy_mcp_server_configuration_github
    - dummy_user connected to dummy_mcp_server_configuration_notion
    - dummy_another_org_member connected to dummy_mcp_server_configuration_github
    """

    connected_accounts = []

    connected_accounts.append(
        crud.connected_accounts.create_connected_account(
            db_session=db_session,
            user_id=dummy_user.id,
            mcp_server_configuration_id=dummy_mcp_server_configuration_github.id,
            auth_credentials={},
        )
    )
    connected_accounts.append(
        crud.connected_accounts.create_connected_account(
            db_session=db_session,
            user_id=dummy_user.id,
            mcp_server_configuration_id=dummy_mcp_server_configuration_notion.id,
            auth_credentials={},
        )
    )
    connected_accounts.append(
        crud.connected_accounts.create_connected_account(
            db_session=db_session,
            user_id=dummy_another_org_member.id,
            mcp_server_configuration_id=dummy_mcp_server_configuration_github.id,
            auth_credentials={},
        )
    )
    return connected_accounts


@pytest.fixture(scope="function")
def dummy_mcp_server_bundles(
    dummy_organization: Organization,
    db_session: Session,
    dummy_user: User,
    dummy_another_org_member: User,
    dummy_mcp_server_configuration_github: MCPServerConfiguration,
    dummy_mcp_server_configuration_notion: MCPServerConfiguration,
) -> list[MCPServerBundle]:
    """
    Test settings:
    - dummy_user has 2 bundles:
        - github + notion
        - github only
    - dummy_another_org_member has 1 bundle:
        - github only
    """
    mcp_server_bundles = []
    mcp_server_bundles.append(
        crud.mcp_server_bundles.create_mcp_server_bundle(
            db_session=db_session,
            user_id=dummy_user.id,
            organization_id=dummy_organization.id,
            mcp_server_bundle_create=MCPServerBundleCreate(
                mcp_server_configuration_ids=[
                    dummy_mcp_server_configuration_github.id,
                    dummy_mcp_server_configuration_notion.id,
                ],
                name="Dummy MCPServerBundle 1 Github + Notion",
                description="Dummy MCPServerBundle 1 Github + Notion Description",
            ),
        )
    )
    mcp_server_bundles.append(
        crud.mcp_server_bundles.create_mcp_server_bundle(
            db_session=db_session,
            user_id=dummy_user.id,
            organization_id=dummy_organization.id,
            mcp_server_bundle_create=MCPServerBundleCreate(
                mcp_server_configuration_ids=[dummy_mcp_server_configuration_github.id],
                name="Dummy MCPServerBundle Github",
                description="Dummy MCPServerBundle 2 Github Description",
            ),
        )
    )
    mcp_server_bundles.append(
        crud.mcp_server_bundles.create_mcp_server_bundle(
            db_session=db_session,
            user_id=dummy_another_org_member.id,
            organization_id=dummy_organization.id,
            mcp_server_bundle_create=MCPServerBundleCreate(
                mcp_server_configuration_ids=[dummy_mcp_server_configuration_github.id],
                name="Dummy MCPServerBundle 3 Github",
                description="Dummy MCPServerBundle 3 Github Description",
            ),
        )
    )
    db_session.commit()
    return mcp_server_bundles


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
