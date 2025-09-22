from uuid import UUID

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


def update_ops_account_auth_credentials(
    db_session: Session,
    ops_account: OpsAccount,
    auth_credentials: dict,
    updated_by_user_id: UUID,
) -> OpsAccount:
    ops_account.auth_credentials = auth_credentials
    ops_account.created_by_user_id = updated_by_user_id
    db_session.flush()
    db_session.refresh(ops_account)
    return ops_account
