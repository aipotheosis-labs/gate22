from typing import Literal, overload

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import MCPTool
from aci.common.schemas.mcp.tool import MCPToolUpsert


@overload
def get_mcp_tool_by_name(
    db_session: Session, name: str, throw_error_if_not_found: Literal[True]
) -> MCPTool: ...


@overload
def get_mcp_tool_by_name(
    db_session: Session, name: str, throw_error_if_not_found: Literal[False]
) -> MCPTool | None: ...


def get_mcp_tool_by_name(
    db_session: Session, name: str, throw_error_if_not_found: bool
) -> MCPTool | None:
    statement = select(MCPTool).where(MCPTool.name == name)

    mcp_tool: MCPTool | None = None
    if throw_error_if_not_found:
        mcp_tool = db_session.execute(statement).scalar_one()
        return mcp_tool
    else:
        mcp_tool = db_session.execute(statement).scalar_one_or_none()
        return mcp_tool


def create_mcp_tools(
    db_session: Session,
    mcp_tool_upserts: list[MCPToolUpsert],
    mcp_tool_embeddings: list[list[float]],
) -> list[MCPTool]:
    """
    Create the mcp tools in the database.
    Each tool might be of a different mcp server.
    """
    mcp_tools = []

    for i, mcp_tool_upsert in enumerate(mcp_tool_upserts):
        mcp_server_name = utils.parse_mcp_server_name_from_mcp_tool_name(mcp_tool_upsert.name)
        mcp_server = crud.mcp_servers.get_mcp_server_by_name(
            db_session, mcp_server_name, throw_error_if_not_found=True
        )

        mcp_tool_data = mcp_tool_upsert.model_dump(mode="json", exclude_none=True)

        mcp_tool = MCPTool(
            mcp_server_id=mcp_server.id,
            **mcp_tool_data,
            embedding=mcp_tool_embeddings[i],
        )
        db_session.add(mcp_tool)
        mcp_tools.append(mcp_tool)

    db_session.flush()
    return mcp_tools


def update_mcp_tools(
    db_session: Session,
    mcp_tool_upserts: list[MCPToolUpsert],
    mcp_tool_embeddings: list[list[float] | None],
) -> list[MCPTool]:
    """
    Update the mcp tools in the database.
    Each tool might be of a different mcp server.
    With the option to update the tool embedding. (needed if ToolEmbeddingFields are updated)
    """
    mcp_tools = []

    for i, mcp_tool_upsert in enumerate(mcp_tool_upserts):
        mcp_tool = crud.mcp_tools.get_mcp_tool_by_name(
            db_session, mcp_tool_upsert.name, throw_error_if_not_found=True
        )
        mcp_tool_data = mcp_tool_upsert.model_dump(mode="json", exclude_none=True)
        for field, value in mcp_tool_data.items():
            setattr(mcp_tool, field, value)

        mcp_tool_embedding = mcp_tool_embeddings[i]
        if mcp_tool_embedding:
            mcp_tool.embedding = mcp_tool_embedding

        mcp_tools.append(mcp_tool)

    db_session.flush()
    return mcp_tools
