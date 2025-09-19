import json
from pathlib import Path
from uuid import UUID

import click
from deepdiff import DeepDiff
from jinja2 import Environment, FileSystemLoader, StrictUndefined, Template
from rich.console import Console
from sqlalchemy.orm import Session

from aci.cli import config
from aci.common import embeddings, utils
from aci.common.db import crud
from aci.common.db.sql_models import MCPServer
from aci.common.openai_client import get_openai_client
from aci.common.schemas.mcp_server import MCPServerEmbeddingFields, PublicMCPServerUpsert

console = Console()


@click.command()
@click.option(
    "--mcp-server-file",
    "mcp_server_file",
    required=True,
    type=click.Path(exists=True, path_type=Path),
    help="Path to the mcp server JSON file",
)
@click.option(
    "--secrets-file",
    "secrets_file",
    type=click.Path(exists=True, path_type=Path),
    default=None,
    show_default=True,
    help="Path to the secrets JSON file",
)
@click.option(
    "--skip-dry-run",
    is_flag=True,
    help="Provide this flag to run the command and apply changes to the database",
)
def upsert_mcp_server(mcp_server_file: Path, secrets_file: Path | None, skip_dry_run: bool) -> UUID:
    """
    Insert or update an MCPServer in the DB from a JSON file, optionally injecting secrets.
    If an mcp server with the given name already exists, performs an update; otherwise, creates a
    new mcp server.
    For changing the mcp server name of an existing mcp server, use the <PLACEHOLDER> command.
    """
    with utils.create_db_session(config.DB_FULL_URL) as db_session:
        return upsert_mcp_server_helper(db_session, mcp_server_file, secrets_file, skip_dry_run)


def upsert_mcp_server_helper(
    db_session: Session, mcp_server_file: Path, secrets_file: Path | None, skip_dry_run: bool
) -> UUID:
    # Load secrets if provided
    secrets = {}
    if secrets_file:
        with open(secrets_file) as f:
            secrets = json.load(f)
    # Render the template in-memory and load JSON data
    try:
        rendered_content = _render_template_to_string(mcp_server_file, secrets)
    except Exception as e:
        console.print(
            f"[bold red]Error rendering template, failed to upsert mcp server: {e}[/bold red]"
        )
        raise e

    mcp_server_upsert = PublicMCPServerUpsert.model_validate(json.loads(rendered_content))
    existing_mcp_server = crud.mcp_servers.get_mcp_server_by_name(
        db_session, mcp_server_upsert.name, throw_error_if_not_found=False
    )
    if existing_mcp_server is None:
        return create_mcp_server_helper(db_session, mcp_server_upsert, skip_dry_run)
    else:
        return update_mcp_server_helper(
            db_session,
            existing_mcp_server,
            mcp_server_upsert,
            skip_dry_run,
        )


def create_mcp_server_helper(
    db_session: Session, mcp_server_upsert: PublicMCPServerUpsert, skip_dry_run: bool
) -> UUID:
    # Generate mcp server embedding using the fields defined in MCPServerEmbeddingFields
    mcp_server_embedding = embeddings.generate_mcp_server_embedding(
        get_openai_client(),
        MCPServerEmbeddingFields.model_validate(mcp_server_upsert.model_dump()),
    )

    # Create the mcp server entry in the database
    mcp_server = crud.mcp_servers.create_public_mcp_server(
        db_session, mcp_server_upsert, mcp_server_embedding
    )

    if not skip_dry_run:
        console.rule(
            f"Provide [bold green]--skip-dry-run[/bold green] to create MCPServer={mcp_server.name}"
        )
        db_session.rollback()
    else:
        db_session.commit()
        console.rule(f"Created MCPServer={mcp_server.name}")

    return mcp_server.id


def update_mcp_server_helper(
    db_session: Session,
    existing_mcp_server: MCPServer,
    mcp_server_upsert: PublicMCPServerUpsert,
    skip_dry_run: bool,
) -> UUID:
    """
    Update an existing mcp server in the database.
    If fields used for generating embeddings (name, display_name, provider, description, categories)
    are changed,
    re-generates the mcp server embedding.
    """
    existing_mcp_server_upsert = PublicMCPServerUpsert.model_validate(
        existing_mcp_server, from_attributes=True
    )
    if existing_mcp_server_upsert == mcp_server_upsert:
        console.rule(f"MCPServer={existing_mcp_server.name} exists and is up to date")
        return existing_mcp_server.id
    else:
        console.rule(f"MCPServer={existing_mcp_server.name} exists and will be updated")

    # Determine if any fields affecting the embedding have changed
    new_embedding = None
    if _need_embedding_regeneration(existing_mcp_server_upsert, mcp_server_upsert):
        new_embedding = embeddings.generate_mcp_server_embedding(
            get_openai_client(),
            MCPServerEmbeddingFields.model_validate(mcp_server_upsert.model_dump()),
        )

    # Update the mcp server in the database with the new fields and optional embedding update
    updated_mcp_server = crud.mcp_servers.update_public_mcp_server(
        db_session, existing_mcp_server, mcp_server_upsert, new_embedding
    )

    diff = DeepDiff(
        existing_mcp_server_upsert.model_dump(), mcp_server_upsert.model_dump(), ignore_order=True
    )

    if not skip_dry_run:
        console.rule(
            f"Provide [bold green]--skip-dry-run[/bold green] to update "
            f"MCPServer={existing_mcp_server.name} with the following changes:"
        )
        db_session.rollback()
    else:
        db_session.commit()
        console.rule(f"Updated MCPServer={existing_mcp_server.name}")

    console.print(diff.pretty())

    return updated_mcp_server.id


def _render_template_to_string(template_path: Path, secrets: dict[str, str]) -> str:
    """
    Render a Jinja2 template with the provided secrets and return as string.
    """
    env = Environment(
        loader=FileSystemLoader(template_path.parent),
        undefined=StrictUndefined,  # Raise error if any placeholders are missing
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )

    template: Template = env.get_template(template_path.name)
    rendered_content: str = template.render(secrets)
    return rendered_content


def _need_embedding_regeneration(
    old_mcp_server: PublicMCPServerUpsert, new_mcp_server: PublicMCPServerUpsert
) -> bool:
    fields = set(MCPServerEmbeddingFields.model_fields.keys())
    return bool(
        old_mcp_server.model_dump(include=fields) != new_mcp_server.model_dump(include=fields)
    )
