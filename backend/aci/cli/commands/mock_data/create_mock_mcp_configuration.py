from uuid import UUID

import click
from openai import OpenAI
from rich.console import Console
from sqlalchemy.orm import Session

from aci.cli import config
from aci.common import utils
from aci.common.db import crud
from aci.common.schemas.mcp_server_bundle import MCPServerBundleCreate
from aci.common.schemas.mcp_server_configuration import MCPServerConfigurationCreate

console = Console()

openai_client = OpenAI(api_key=config.OPENAI_API_KEY)


@click.command()
@click.option(
    "--mcp-server",
    "mcp_server",
    type=str,
    default=None,
    show_default=True,
    help="MCP server name",
)
@click.option(
    "--user-id",
    "user_id",
    type=UUID,
    default=None,
    show_default=True,
    help="User ID",
)
@click.option(
    "--team-id",
    "team_id",
    type=UUID,
    default=None,
    show_default=True,
    help="Team ID",
)
@click.option(
    "--skip-dry-run",
    is_flag=True,
    help="Provide this flag to run the command and apply changes to the database",
)
def create_mock_mcp_configuration(
    mcp_server: str, user_id: UUID, team_id: UUID, skip_dry_run: bool
) -> None:
    """
    Create mock MCP Server Configuration, added to user's team, create a connected account and
    create a bundle that includes the mcp server configuration.
    """
    with utils.create_db_session(config.DB_FULL_URL) as db_session:
        create_mock_mcp_configuration_helper(db_session, mcp_server, user_id, team_id, skip_dry_run)


def create_mock_mcp_configuration_helper(
    db_session: Session, mcp_server_name: str, user_id: UUID, team_id: UUID, skip_dry_run: bool
) -> None:
    mcp_server = crud.mcp_servers.get_mcp_server_by_name(
        db_session, mcp_server_name, throw_error_if_not_found=True
    )
    user = crud.users.get_user_by_id(db_session, user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")
    team = crud.teams.get_team_by_id(db_session, team_id)
    if not team:
        raise ValueError(f"Team {team_id} not found")

    # Create MCP Server Configuration
    mcp_server_configuration = crud.mcp_server_configurations.create_mcp_server_configuration(
        db_session,
        team.organization_id,
        MCPServerConfigurationCreate(
            mcp_server_id=mcp_server.id,
            auth_type=mcp_server.auth_configs[0]["type"],
            all_tools_enabled=True,
            enabled_tools=[],
            allowed_teams=[team.id],
        ),
    )

    # Create Connected Account
    connected_account = crud.connected_accounts.create_connected_account(
        db_session, user.id, mcp_server_configuration.id, {}
    )

    # Create MCP Server Bundle
    mcp_server_bundle = crud.mcp_server_bundles.create_mcp_server_bundle(
        db_session,
        user.id,
        team.organization_id,
        MCPServerBundleCreate(
            name=f"{user_id} bundle",
            description=f"Bundle for {mcp_server_name} configuration",
            mcp_server_configuration_ids=[mcp_server_configuration.id],
        ),
    )

    if not skip_dry_run:
        console.rule(
            "Provide [bold green]--skip-dry-run[/bold green] to create MCP Server Configuration, "
            "Connected Account, and MCP Server Bundle"
        )
        db_session.rollback()
    else:
        db_session.commit()
        console.rule(f"Created MCP Server Configuration={mcp_server_configuration.id}")
        console.rule(f"Created Connected Account={connected_account.id}")
        console.rule(f"Created MCP Server Bundle={mcp_server_bundle.id}")
