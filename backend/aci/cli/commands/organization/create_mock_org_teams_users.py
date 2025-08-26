import uuid

import click
from rich.console import Console

from aci.cli import config
from aci.common import utils
from aci.common.db import crud
from aci.common.enums import OrganizationRole, UserIdentityProvider
from aci.control_plane.routes import auth

console = Console()


@click.command()
@click.option(
    "--skip-dry-run",
    is_flag=True,
    help="provide this flag to run the command and apply changes to the database",
)
def create_mock_org_teams_users(
    skip_dry_run: bool,
) -> None:
    """
    Create a mock organization with teams and users in db.

    This creates the following mock settings:

    Organization: ACI Dev Org

    Users:
    - Admin (admin@aci.dev) - Admin role
    - User1 (user1@aci.dev) - Member role
    - User2 (user2@aci.dev) - Member role

    Teams:
    - Team 1 (Admin, User1)
    - Team 2 (Admin, User1, User2)
    """

    short_id = uuid.uuid4().hex[:8]

    with utils.create_db_session(config.DB_FULL_URL) as db_session:
        # Create organization
        organization = crud.organizations.create_organization(
            db_session, f"ACI Dev Org {short_id}", f"ACI Dev Org {short_id} Description"
        )

        # Create users
        admin = crud.users.create_user(
            db_session,
            name="ACI Admin",
            email=f"admin-{short_id}@aci.dev",
            password_hash=auth._hash_user_password("password"),
            identity_provider=UserIdentityProvider.EMAIL,
        )
        user1 = crud.users.create_user(
            db_session,
            name="ACI User 1",
            email=f"user1-{short_id}@aci.dev",
            password_hash=auth._hash_user_password("password"),
            identity_provider=UserIdentityProvider.EMAIL,
        )
        user2 = crud.users.create_user(
            db_session,
            name="ACI User 2",
            email=f"user2-{short_id}@aci.dev",
            password_hash=auth._hash_user_password("password"),
            identity_provider=UserIdentityProvider.EMAIL,
        )

        # Add users to organization
        crud.organizations.add_user_to_organization(
            db_session, organization.id, admin.id, OrganizationRole.ADMIN
        )
        crud.organizations.add_user_to_organization(
            db_session, organization.id, user1.id, OrganizationRole.MEMBER
        )
        crud.organizations.add_user_to_organization(
            db_session, organization.id, user2.id, OrganizationRole.MEMBER
        )

        # Create teams
        team1 = crud.teams.create_team(db_session, organization.id, f"Team 1 - {short_id}")
        crud.teams.add_team_member(db_session, organization.id, team1.id, admin.id)
        crud.teams.add_team_member(db_session, organization.id, team1.id, user1.id)

        team2 = crud.teams.create_team(db_session, organization.id, f"Team 2 - {short_id}")
        crud.teams.add_team_member(db_session, organization.id, team2.id, admin.id)
        crud.teams.add_team_member(db_session, organization.id, team2.id, user1.id)
        crud.teams.add_team_member(db_session, organization.id, team2.id, user2.id)

        # Create JWTs
        jwt_admin = auth._sign_token(admin, None)
        jwt_user1 = auth._sign_token(user1, None)
        jwt_user2 = auth._sign_token(user2, None)

        if not skip_dry_run:
            console.rule(
                "[bold green]Provide --skip-dry-run to create mock organization[/bold green]"
            )
            db_session.rollback()
        else:
            db_session.commit()
            console.rule("[bold green]Organization created with following hierarchy[/bold green]")
            console.print(f"""Organization:
ACI DevOrg {short_id}

Users:
- Admin (admin-{short_id}@aci.dev) - Admin role
- User1 (user1-{short_id}@aci.dev) - Member role
- User2 (user2-{short_id}@aci.dev) - Member role

Teams:
- Team 1 - {short_id} (Admin, User1)
- Team 2 - {short_id} (Admin, User1, User2)
            """)
            console.print(
                f"Admin JWT:\n{jwt_admin}\n", style="bold yellow", overflow="ignore", soft_wrap=True
            )
            console.print(
                f"User 1 JWT:\n{jwt_user1}\n",
                style="bold yellow",
                overflow="ignore",
                soft_wrap=True,
            )
            console.print(
                f"User 2 JWT:\n{jwt_user2}\n",
                style="bold yellow",
                overflow="ignore",
                soft_wrap=True,
            )
