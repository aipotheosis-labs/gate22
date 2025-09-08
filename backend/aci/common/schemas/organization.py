import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from aci.common.enums import OrganizationRole, TeamRole
from aci.control_plane import config


class CreateOrganizationRequest(BaseModel):
    name: str = Field(
        min_length=1, max_length=config.FIELD_NAME_MAX_LENGTH, description="Organization name"
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=config.FIELD_DESCRIPTION_MAX_LENGTH,
        description="Organization description",
    )


class OrganizationInfo(BaseModel):
    organization_id: UUID
    name: str
    description: str | None = None


class OrganizationMembershipInfo(BaseModel):
    user_id: UUID
    name: str
    email: str
    role: OrganizationRole
    created_at: datetime.datetime


class UpdateOrganizationMemberRoleRequest(BaseModel):
    role: OrganizationRole


class CreateOrganizationTeamRequest(BaseModel):
    name: str = Field(
        min_length=1, max_length=config.FIELD_NAME_MAX_LENGTH, description="Team name"
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=config.FIELD_DESCRIPTION_MAX_LENGTH,
        description="Team description",
    )


class TeamInfo(BaseModel):
    team_id: UUID
    name: str
    description: str | None = None
    created_at: datetime.datetime


class TeamMembershipInfo(BaseModel):
    user_id: UUID
    name: str
    email: str
    role: TeamRole
    created_at: datetime.datetime
