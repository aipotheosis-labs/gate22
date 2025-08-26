from functools import partial
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import ActAsInfo
from aci.common.schemas.organizations import (
    CreateOrganizationRequest,
    CreateOrganizationTeamRequest,
    OrganizationInfo,
    OrganizationMembershipInfo,
    TeamInfo,
    TeamMembershipInfo,
    UpdateOrganizationMemberRoleRequest,
)
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


def _throw_if_not_permitted(
    act_as: ActAsInfo,
    requested_organization_id: UUID | None = None,
    required_role: OrganizationRole = OrganizationRole.MEMBER,
) -> None:
    """
    This function throws an HTTPException if the user is not permitted to act as the requested
    organization and role.
    """
    if requested_organization_id and act_as.organization_id != requested_organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    if required_role == OrganizationRole.ADMIN and act_as.role != OrganizationRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)


@router.post("/", response_model=OrganizationInfo, status_code=status.HTTP_201_CREATED)
async def create_organization(
    context: Annotated[
        deps.RequestContextWithoutActAs,
        Depends(partial(deps.get_request_context, is_act_as_required=False)),
    ],
    request: CreateOrganizationRequest,
) -> OrganizationInfo:
    # Every logged in user can create an organization. No permission check.

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
        organization_id=organization.id,
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
    # Check user's role permission
    _throw_if_not_permitted(context.act_as, requested_organization_id=organization_id)

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
    # Check user's role permission
    _throw_if_not_permitted(context.act_as, requested_organization_id=organization_id)

    # Admin can remove anyone in the organization
    if context.act_as.role == OrganizationRole.ADMIN:
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
    elif context.act_as.role == OrganizationRole.MEMBER:
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
    # Check user's role permission
    _throw_if_not_permitted(
        context.act_as,
        requested_organization_id=organization_id,
        required_role=OrganizationRole.ADMIN,
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


# ------------------------------------------------------------
#
# Team Management
#
# ------------------------------------------------------------
@router.post(
    "/{organization_id}/teams", response_model=TeamInfo, status_code=status.HTTP_201_CREATED
)
async def create_team(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    request: CreateOrganizationTeamRequest,
) -> TeamInfo:
    # Check user's role permission
    _throw_if_not_permitted(
        context.act_as,
        requested_organization_id=organization_id,
        required_role=OrganizationRole.ADMIN,
    )

    # Check if team name already exists
    if crud.teams.get_team_by_organization_id_and_name(
        context.db_session, organization_id, request.name
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team name already exists",
        )

    # Create team
    team = crud.teams.create_team(
        db_session=context.db_session,
        organization_id=organization_id,
        name=request.name,
        description=request.description,
    )

    context.db_session.commit()

    return TeamInfo(
        team_id=team.id,
        name=team.name,
        description=team.description,
        created_at=team.created_at,
    )


@router.get(
    "/{organization_id}/teams", response_model=list[TeamInfo], status_code=status.HTTP_200_OK
)
async def list_teams(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
) -> list[TeamInfo]:
    # Check user's role permission
    _throw_if_not_permitted(context.act_as, requested_organization_id=organization_id)

    # Get organization teams
    teams = crud.teams.get_teams_by_organization_id(
        db_session=context.db_session,
        organization_id=organization_id,
    )
    return [
        TeamInfo(
            team_id=team.id,
            name=team.name,
            description=team.description,
            created_at=team.created_at,
        )
        for team in teams
    ]


@router.get(
    "/{organization_id}/teams/{team_id}/members",
    response_model=list[TeamMembershipInfo],
    status_code=status.HTTP_200_OK,
)
async def list_team_members(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    team_id: UUID,
) -> list[TeamMembershipInfo]:
    # Check user's role permission
    _throw_if_not_permitted(context.act_as, requested_organization_id=organization_id)

    # Get team members
    team_members = crud.teams.get_team_members(
        db_session=context.db_session,
        team_id=team_id,
    )
    return [
        TeamMembershipInfo(
            user_id=member.user_id,
            name=member.user.name,
            email=member.user.email,
            role=member.role,
            created_at=member.created_at,
        )
        for member in team_members
    ]


@router.put("/{organization_id}/teams/{team_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def add_team_member(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    team_id: UUID,
    user_id: UUID,
) -> None:
    # Check user's role permission
    _throw_if_not_permitted(
        context.act_as,
        requested_organization_id=organization_id,
        required_role=OrganizationRole.ADMIN,
    )

    # Check if user is a member of the organization
    if not crud.organizations.is_user_in_organization(context.db_session, organization_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not a member of the organization",
        )

    # Check if targeted user is already a member of the team
    if crud.teams.get_team_members(context.db_session, team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User already a member of the team"
        )

    # Add team member
    crud.teams.add_team_member(
        db_session=context.db_session,
        organization_id=organization_id,
        team_id=team_id,
        user_id=user_id,
    )

    context.db_session.commit()

    return None


@router.delete(
    "/{organization_id}/teams/{team_id}/members/{user_id}", status_code=status.HTTP_200_OK
)
async def remove_team_member(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    organization_id: UUID,
    team_id: UUID,
    user_id: UUID,
) -> None:
    # Check user's role permission
    _throw_if_not_permitted(context.act_as, requested_organization_id=organization_id)

    # Admin can remove anyone in the team
    if context.act_as.role == OrganizationRole.ADMIN:
        # No blocking.
        pass

    # Member can only remove themselves
    elif context.act_as.role == OrganizationRole.MEMBER:
        if context.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove other members"
            )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    # Check if targeted user is a member of the team
    if not crud.teams.get_team_members(context.db_session, team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User is not a member of the team"
        )

    # Remove team member
    crud.teams.remove_team_member(
        db_session=context.db_session,
        organization_id=organization_id,
        team_id=team_id,
        user_id=user_id,
    )

    context.db_session.commit()

    return None
