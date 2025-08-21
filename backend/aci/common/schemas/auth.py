from pydantic import BaseModel


class ActAsInfo(BaseModel):
    organization_id: str
    role: str


class JWTPayload(BaseModel):
    sub: str
    exp: int
    user_id: str
    name: str
    email: str
    act_as: ActAsInfo | None
