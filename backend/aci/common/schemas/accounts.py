from typing import Annotated, Literal

from pydantic import BaseModel, Field

from aci.common.enums import OrganizationRole, UserIdentityProvider


class EmailPwdRegistrationRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.EMAIL]
    name: str
    email: str
    password: str


class GoogleRegistrationRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.GOOGLE]
    auth_code: str


RegistrationRequest = Annotated[
    EmailPwdRegistrationRequest | GoogleRegistrationRequest, Field(discriminator="auth_flow")
]


class EmailPwdLoginRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.EMAIL]
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    auth_flow: Literal[UserIdentityProvider.GOOGLE]
    auth_code: str


LoginRequest = Annotated[
    EmailPwdLoginRequest | GoogleLoginRequest, Field(discriminator="auth_flow")
]


class TokenResponse(BaseModel):
    token: str


class ExchangeTokensRequest(BaseModel):
    organization_id: str | None
    role: OrganizationRole | None


class OrganizationMembershipInfo(BaseModel):
    organization_id: str
    organization_name: str
    role: OrganizationRole


class UserInfo(BaseModel):
    user_id: str
    name: str
    email: str
    organizations: list[OrganizationMembershipInfo]
