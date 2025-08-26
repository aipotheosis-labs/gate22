from uuid import UUID

from pydantic import BaseModel

from aci.common.enums import OrganizationRole


class UserOrganizationInfo(BaseModel):
    organization_id: UUID
    organization_name: str
    role: OrganizationRole


class UserInfo(BaseModel):
    user_id: UUID
    name: str
    email: str
    organizations: list[UserOrganizationInfo]
