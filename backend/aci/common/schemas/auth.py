from uuid import UUID

from pydantic import BaseModel

from aci.common.enums import OrganizationRole


class ActAsInfo(BaseModel):
    organization_id: UUID
    role: OrganizationRole


class JWTPayload(BaseModel):
    sub: str
    exp: int
    iat: int
    user_id: UUID
    name: str
    email: str
    act_as: ActAsInfo | None
