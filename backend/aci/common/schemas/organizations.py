import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from aci.common.enums import OrganizationRole


class CreateOrganizationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="Organization name")
    description: str | None = Field(
        default=None, min_length=1, max_length=255, description="Organization description"
    )


class OrganizationInfo(BaseModel):
    organization_id: str
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
