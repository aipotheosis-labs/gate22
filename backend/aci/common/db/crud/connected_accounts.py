from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import ConnectedAccount


def get_connected_account_by_user_id_and_mcp_server_configuration_id(
    db_session: Session,
    user_id: UUID,
    mcp_server_configuration_id: UUID,
) -> ConnectedAccount | None:
    statement = select(ConnectedAccount).where(
        ConnectedAccount.user_id == user_id,
        ConnectedAccount.mcp_server_configuration_id == mcp_server_configuration_id,
    )
    connected_account = db_session.execute(statement).scalar_one_or_none()
    return connected_account


def update_connected_account_auth_credentials(
    db_session: Session,
    connected_account: ConnectedAccount,
    auth_credentials: dict,
) -> ConnectedAccount:
    connected_account.auth_credentials = auth_credentials
    db_session.flush()
    db_session.refresh(connected_account)
    return connected_account


def create_connected_account(
    db_session: Session,
    user_id: UUID,
    mcp_server_configuration_id: UUID,
    auth_credentials: dict,
) -> ConnectedAccount:
    connected_account = ConnectedAccount(
        user_id=user_id,
        mcp_server_configuration_id=mcp_server_configuration_id,
        auth_credentials=auth_credentials,
    )

    db_session.add(connected_account)
    db_session.flush()
    db_session.refresh(connected_account)
    return connected_account
