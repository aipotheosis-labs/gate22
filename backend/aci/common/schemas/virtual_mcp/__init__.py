from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel

from aci.common.enums import HttpLocation, HttpMethod, VirtualMCPToolType


class RestVirtualMCPToolMetadata(BaseModel):
    type: Literal[VirtualMCPToolType.REST] = VirtualMCPToolType.REST
    method: HttpMethod
    # NOTE: unlike the tool-calling platform where we separate "path" and "server_url",
    # here we combine them into a single field "endpoint"
    endpoint: str


class ConnectorVirtualMCPToolMetadata(BaseModel, extra="forbid"):
    # NOTE: for now we don't allow any fields for connector type
    type: Literal[VirtualMCPToolType.CONNECTOR] = VirtualMCPToolType.CONNECTOR


class VirtualMCPToolMetadata(
    RootModel[
        Annotated[
            RestVirtualMCPToolMetadata | ConnectorVirtualMCPToolMetadata,
            Field(discriminator="type"),
        ]
    ]
):
    pass


class VirtualMCPAuthTokenData(BaseModel):
    """
    example:
    {
        "location": "header",
        "name": "Authorization",
        "prefix": "Bearer",
        "token": "1234567890"
    }
    """

    location: HttpLocation
    name: str
    prefix: str | None = None
    token: str
