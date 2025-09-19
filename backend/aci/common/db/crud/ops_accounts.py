from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.orm import Session

from aci.common.db.sql_models import OpsAccount


def create_ops_account(
    db_session: Session,
    created_by_user_id: UUID,
    mcp_server_id: UUID,
    auth_credentials: dict,
) -> OpsAccount:
    ops_account = OpsAccount(
        mcp_server_id=mcp_server_id,
        auth_credentials=auth_credentials,
        created_by_user_id=created_by_user_id,
    )

    db_session.add(ops_account)
    db_session.flush()
    db_session.refresh(ops_account)
    return ops_account


def delete_ops_account_by_id(
    db_session: Session,
    ops_account_id: UUID,
) -> None:
    statement = delete(OpsAccount).where(OpsAccount.id == ops_account_id)
    db_session.execute(statement)
