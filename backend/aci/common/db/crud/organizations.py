from uuid import UUID

from sqlalchemy.orm import Session

from aci.common.db.sql_models import Organization, OrganizationMembership
from aci.common.enums import OrganizationRole


def create_organization(
    db_session: Session,
    name: str,
    description: str | None = None,
) -> Organization:
    organization = Organization(name=name, description=description)
    db_session.add(organization)
    db_session.flush()
    db_session.refresh(organization)
    return organization


def get_organization_by_id(
    db_session: Session,
    organization_id: UUID,
) -> Organization | None:
    return (
        db_session.query(Organization)
        .filter(Organization.id == organization_id)
        .filter(Organization.deleted_at.is_(None))
        .first()
    )


def get_organization_by_name(
    db_session: Session,
    name: str,
) -> Organization | None:
    return (
        db_session.query(Organization)
        .filter(Organization.name == name)
        .filter(Organization.deleted_at.is_(None))
        .first()
    )


def add_user_to_organization(
    db_session: Session,
    organization_id: UUID,
    user_id: UUID,
    role: OrganizationRole,
) -> None:
    organization_membership = OrganizationMembership(
        organization_id=organization_id, user_id=user_id, role=role
    )
    db_session.add(organization_membership)
    db_session.flush()
    db_session.refresh(organization_membership)


def get_organization_members(
    db_session: Session,
    organization_id: UUID,
) -> list[OrganizationMembership]:
    return (
        db_session.query(OrganizationMembership)
        .filter(OrganizationMembership.organization_id == organization_id)
        .order_by(OrganizationMembership.created_at.desc())
        .all()
    )


def is_user_in_organization(
    db_session: Session,
    organization_id: UUID,
    user_id: UUID,
) -> bool:
    return (
        db_session.query(OrganizationMembership)
        .filter(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
        )
        .first()
        is not None
    )


def get_organization_membership(
    db_session: Session,
    organization_id: UUID,
    user_id: UUID,
) -> OrganizationMembership | None:
    return (
        db_session.query(OrganizationMembership)
        .filter(OrganizationMembership.organization_id == organization_id)
        .filter(OrganizationMembership.user_id == user_id)
        .first()
    )


def remove_organization_member(
    db_session: Session,
    organization_id: UUID,
    user_id: UUID,
) -> None:
    db_session.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == organization_id
    ).filter(OrganizationMembership.user_id == user_id).delete()
    db_session.flush()


def update_organization_member_role(
    db_session: Session,
    organization_id: UUID,
    user_id: UUID,
    role: OrganizationRole,
) -> None:
    db_session.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.user_id == user_id,
    ).update({"role": role})
    db_session.flush()
