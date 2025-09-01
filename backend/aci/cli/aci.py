import click

from aci.cli.commands import mcp, mock_data
from aci.common.logging_setup import setup_logging

setup_logging()


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def cli() -> None:
    pass


cli.add_command(mcp.upsert_mcp_server, name="upsert-mcp-server")
cli.add_command(mcp.upsert_mcp_tools, name="upsert-mcp-tools")
cli.add_command(mock_data.create_mock_org_teams_users, name="create-mock-org-teams-users")
cli.add_command(mock_data.create_mock_mcp_configuration, name="create-mock-mcp-configuration")


if __name__ == "__main__":
    cli()
