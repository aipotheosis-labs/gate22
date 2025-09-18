from typing import Literal, overload

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import VirtualMCPServer


# overloads for type hints
@overload
def get_virtual_mcp_server(
    db_session: Session,
    name: str,
    throw_error_if_not_found: Literal[True],
) -> VirtualMCPServer: ...


@overload
def get_virtual_mcp_server(
    db_session: Session,
    name: str,
    throw_error_if_not_found: Literal[False],
) -> VirtualMCPServer | None: ...


def get_virtual_mcp_server(
    db_session: Session,
    name: str,
    throw_error_if_not_found: bool = False,
) -> VirtualMCPServer | None:
    statement = select(VirtualMCPServer).where(VirtualMCPServer.name == name)
    if throw_error_if_not_found:
        return db_session.execute(statement).scalar_one()
    else:
        return db_session.execute(statement).scalar_one_or_none()
