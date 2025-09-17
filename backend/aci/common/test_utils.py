import logging

from sqlalchemy.orm import Session

from aci.common.db.sql_models import Base

logger = logging.getLogger(__name__)


def clear_database(db_session: Session) -> None:
    """
    Clear all tables in the database except alembic_version.
    """
    for table in reversed(Base.metadata.sorted_tables):
        if table.name != "alembic_version" and db_session.query(table).count() > 0:
            logger.debug(f"Deleting all records from table {table.name}")
            db_session.execute(table.delete())
    db_session.commit()
