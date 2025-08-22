from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.organizations import (
    CreateOrganizationRequest,
    OrganizationInfo,
    OrganizationMembershipInfo,
    UpdateOrganizationMemberRoleRequest,
)
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.post("/", response_model=OrganizationInfo, status_code=status.HTTP_201_CREATED)
async def create_organization(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    request: CreateOrganizationRequest,
) -> OrganizationInfo:
    # Check if organization name already used
    if crud.organizations.get_organization_by_name(context.db_session, request.name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Organization name already used"
        )

    # Create organization
    organization = crud.organizations.create_organization(
        db_session=context.db_session,
        name=request.name,
        description=request.description,
    )

    # Add user into organization. First user must be Admin
    crud.organizations.add_user_to_organization(
        db_session=context.db_session,
        organization_id=organization.id,
        user_id=context.user_id,
        role=OrganizationRole.ADMIN,
    )

    context.db_session.commit()

    return OrganizationInfo(
        organization_id=str(organization.id),
        name=organization.name,
        description=organization.description,
    )


# ------------------------------------------------------------
#
# Organization Memberships Management
#
# ------------------------------------------------------------


@router.get(
    "/{organization_id}/members",
    response_model=list[OrganizationMembershipInfo],
    status_code=status.HTTP_200_OK,
)
async def list_organization_members(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
) -> list[OrganizationMembershipInfo]:
    # Check if user currently acting as the requested organization
    if context.act_as and context.act_as.organization_id == organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    # Get organization members
    organization_members = crud.organizations.get_organization_members(
        db_session=context.db_session,
        organization_id=organization_id,
    )
    return [
        OrganizationMembershipInfo(
            user_id=member.user_id,
            name=member.user.name,
            email=member.user.email,
            role=member.role,
            created_at=member.created_at,
        )
        for member in organization_members
    ]


@router.delete("/{organization_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_organization_member(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    user_id: UUID,
) -> None:
    # Check if user currently acting as the requested organization
    if context.act_as and context.act_as.organization_id == organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    # Admin can remove anyone in the organization
    if context.act_as and context.act_as.role == OrganizationRole.ADMIN:
        # Check if user is the last admin in the organization, if so, raise an error
        organization_members = crud.organizations.get_organization_members(
            db_session=context.db_session,
            organization_id=organization_id,
        )
        admins = list(
            filter(lambda member: member.role == OrganizationRole.ADMIN, organization_members)
        )
        if len(admins) == 1 and admins[0].user_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot remove the last admin in the organization",
            )

    # Member can only remove themselves
    elif context.act_as and context.act_as.role == OrganizationRole.MEMBER:
        if context.user_id != str(user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove other members"
            )

    # All checks pass. Now remove member
    crud.organizations.remove_organization_member(
        db_session=context.db_session,
        organization_id=organization_id,
        user_id=user_id,
    )

    context.db_session.commit()


@router.patch("/{organization_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def update_organization_member_role(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    user_id: UUID,
    request: UpdateOrganizationMemberRoleRequest,
) -> None:
    # Check if user currently acting as the requested organization
    if context.act_as and context.act_as.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    # Only admin can update member role
    if context.act_as and context.act_as.role != OrganizationRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have no permission to update member role",
        )

    # Check if user is the last admin in the organization, if so, raise an error
    organization_members = crud.organizations.get_organization_members(
        db_session=context.db_session,
        organization_id=organization_id,
    )
    admins = list(
        filter(lambda member: member.role == OrganizationRole.ADMIN, organization_members)
    )
    # If the targeted user is last admin, and the request is to remove the admin role, raise error
    if len(admins) == 1 and admins[0].user_id == user_id and request.role != OrganizationRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot downgrade the last admin in the organization",
        )

    # Update member role
    crud.organizations.update_organization_member_role(
        db_session=context.db_session,
        organization_id=organization_id,
        user_id=user_id,
        role=request.role,
    )

    context.db_session.commit()
