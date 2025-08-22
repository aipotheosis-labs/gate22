import re
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from aci.common.enums import OrganizationRole, UserIdentityProvider


class EmailPwdRegistrationRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.EMAIL] = Field(description="Authentication flow")
    name: str = Field(min_length=1, max_length=100, description="User name")
    email: EmailStr = Field(min_length=1, max_length=255, description="User email")
    password: str = Field(min_length=1, max_length=255, description="User password")

    # TODO: Define password strength requirements
    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        if not re.search(r"[@$!%*?&]", v):
            raise ValueError("Password must contain a special character (@$!%*?&)")
        return v


class GoogleRegistrationRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.GOOGLE] = Field(description="Authentication flow")
    code: str = Field(description="Authentication code obtained")
    code_verifier: str = Field(description="Code verifier obtained")


RegistrationRequest = Annotated[
    EmailPwdRegistrationRequest | GoogleRegistrationRequest, Field(discriminator="auth_flow")
]


class EmailPwdLoginRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.EMAIL] = Field(description="Authentication flow")
    email: str = Field(min_length=1, max_length=255, description="User email")
    password: str = Field(min_length=1, max_length=255, description="User password")


class GoogleLoginRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.GOOGLE] = Field(description="Authentication flow")
    auth_code: str = Field(description="Authentication code obtained")


LoginRequest = Annotated[
    EmailPwdLoginRequest | GoogleLoginRequest, Field(discriminator="auth_flow")
]


class TokenResponse(BaseModel):
    token: str


class RefreshTokenRequest(BaseModel):
    operation: Literal["refresh"]


class UpdateActAsRequest(BaseModel):
    operation: Literal["update_act_as"]
    organization_id: UUID
    role: OrganizationRole


IssueTokenRequest = Annotated[
    RefreshTokenRequest | UpdateActAsRequest, Field(discriminator="operation")
]


class UserOrganizationInfo(BaseModel):
    organization_id: UUID
    organization_name: str
    role: OrganizationRole


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
