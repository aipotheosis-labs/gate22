import click

from aci.cli.commands import mcp
from aci.common.logging_setup import setup_logging

setup_logging()


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def cli() -> None:
    pass


cli.add_command(mcp.upsert_mcp_server, name="upsert-mcp-server")


if __name__ == "__main__":
    cli()
