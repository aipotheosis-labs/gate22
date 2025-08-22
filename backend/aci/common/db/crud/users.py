from uuid import UUID

from sqlalchemy.orm import Session

from aci.common.db.sql_models import User
from aci.common.enums import UserIdentityProvider


def create_user(
    db_session: Session,
    name: str,
    email: str,
    password_hash: str,
    identity_provider: UserIdentityProvider,
) -> User:
    user = User(
        name=name,
        email=email,
        email_verified=False,
        password_hash=password_hash,
        identity_provider=identity_provider,
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


def get_user_by_email(db_session: Session, email: str) -> User | None:
    return db_session.query(User).filter(User.email == email).first()


def get_user_by_id(db_session: Session, user_id: UUID) -> User | None:
    return db_session.query(User).filter(User.id == user_id).first()
