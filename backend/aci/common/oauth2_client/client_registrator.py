from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
from pydantic import ValidationError

from aci.common.exceptions import OAuth2ClientRegistrationError
from aci.common.oauth2_client.schema import (
    OAuthClientInformationFull,
    OAuthClientMetadata,
    OAuthMetadata,
)


@dataclass
class RegistrationContext:
    server_url: str
    client_metadata: OAuthClientMetadata
    oauth_metadata: OAuthMetadata
    client_info: OAuthClientInformationFull | None = None

    def get_authorization_base_url(self, server_url: str) -> str:
        """Extract base URL by removing path component."""
        parsed = urlparse(server_url)
        return f"{parsed.scheme}://{parsed.netloc}"


class ClientRegistrator:
    def __init__(
        self,
        server_url: str,
        client_metadata: OAuthClientMetadata,
        oauth_metadata: OAuthMetadata,
        client_info: OAuthClientInformationFull | None = None,
    ):
        self.context = RegistrationContext(
            server_url=server_url,
            client_metadata=client_metadata,
            oauth_metadata=oauth_metadata,
            client_info=client_info,
        )

    def _register_client(self) -> None:
        """Build registration request or skip if already registered."""
        if self.context.client_info:
            return

        if self.context.oauth_metadata and self.context.oauth_metadata.registration_endpoint:
            registration_url = str(self.context.oauth_metadata.registration_endpoint)
        else:
            auth_base_url = self.context.get_authorization_base_url(self.context.server_url)
            registration_url = urljoin(auth_base_url, "/register")

        registration_data = self.context.client_metadata.model_dump(
            by_alias=True, mode="json", exclude_none=True
        )

        response = httpx.post(
            registration_url,
            json=registration_data,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code not in (200, 201):
            response.read()
            raise OAuth2ClientRegistrationError(
                f"Registration failed: {response.status_code} {response.text}"
            )

        try:
            content = response.read()
            client_info = OAuthClientInformationFull.model_validate_json(content)
            self.context.client_info = client_info
        except ValidationError as e:
            raise OAuth2ClientRegistrationError(f"Invalid registration response: {e}") from e

    def dynamic_client_registration(self) -> OAuthClientInformationFull:
        self._register_client()

        if self.context.client_info is None:
            raise OAuth2ClientRegistrationError("Client information not found")

        return self.context.client_info
