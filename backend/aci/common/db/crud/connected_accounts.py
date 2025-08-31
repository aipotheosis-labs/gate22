from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import ConnectedAccount, MCPServerConfiguration
from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


def get_connected_accounts_by_user_id(
    db_session: Session,
    user_id: UUID,
) -> list[ConnectedAccount]:
    statement = select(ConnectedAccount).where(ConnectedAccount.user_id == user_id)
    connected_accounts = db_session.execute(statement).scalars().all()
    return list(connected_accounts)


def get_connected_account_by_id(
    db_session: Session,
    connected_account_id: UUID,
) -> ConnectedAccount | None:
    statement = select(ConnectedAccount).where(ConnectedAccount.id == connected_account_id)
    connected_account = db_session.execute(statement).scalar_one_or_none()
    return connected_account


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


def get_connected_accounts_by_user_id_and_organization_id(
    db_session: Session,
    user_id: UUID,
    organization_id: UUID,
    offset: int | None = None,
    limit: int | None = None,
) -> list[ConnectedAccount]:
    statement = (
        select(ConnectedAccount)
        .join(ConnectedAccount.mcp_server_configuration)
        .where(
            ConnectedAccount.user_id == user_id,
            MCPServerConfiguration.organization_id == organization_id,
        )
        .order_by(ConnectedAccount.created_at.desc())
    )
    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    return list(db_session.execute(statement).scalars().all())


def get_connected_accounts_by_organization_id(
    db_session: Session,
    organization_id: UUID,
    offset: int | None = None,
    limit: int | None = None,
) -> list[ConnectedAccount]:
    statement = (
        select(ConnectedAccount)
        .join(ConnectedAccount.mcp_server_configuration)
        .where(MCPServerConfiguration.organization_id == organization_id)
        .order_by(ConnectedAccount.created_at.desc())
    )
    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)
    return list(db_session.execute(statement).scalars().all())


def delete_connected_account(
    db_session: Session,
    connected_account_id: UUID,
) -> None:
    statement = delete(ConnectedAccount).where(ConnectedAccount.id == connected_account_id)
    db_session.execute(statement)
