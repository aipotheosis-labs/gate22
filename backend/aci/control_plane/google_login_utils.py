import jwt
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from pydantic import BaseModel

from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import AuthOperation, OAuth2State
from aci.control_plane import config
from aci.control_plane.exceptions import OAuth2Error
from aci.control_plane.oauth2_manager import OAuth2Manager

logger = get_logger(__name__)

# Singleton OAuth2Manager
google_oauth2_manager = OAuth2Manager(
    app_name="ACI.dev",  # Not in used in this flow.
    client_id=config.GOOGLE_CLIENT_ID,
    client_secret=config.GOOGLE_CLIENT_SECRET,
    scope="openid email profile",
    authorize_url="https://accounts.google.com/o/oauth2/auth",
    access_token_url="https://oauth2.googleapis.com/token",
    refresh_token_url="https://oauth2.googleapis.com/token",
    token_endpoint_auth_method="client_secret_basic",
)


class GoogleUserInfo(BaseModel):
    name: str
    email: str


def _get_google_redirect_uri(operation: AuthOperation) -> str:
    url = f"{config.GOOGLE_OAUTH_REDIRECT_URI_BASE}/v1/auth/{operation.value}/google/callback"
    return url


async def generate_google_auth_url(operation: AuthOperation, post_oauth_redirect_uri: str) -> str:
    # State is a JWT that contains the code verifier, redirect URI, and client ID.
    # After the user authorizes the app, the frontend should pass the state back to the backend.
    # Then we should verify the JWT and decode the state & code verifier and fetch the access token.
    code_verifier = google_oauth2_manager.generate_code_verifier()

    oauth2_state_jwt = jwt.encode(
        OAuth2State(
            code_verifier=code_verifier,
            redirect_uri=_get_google_redirect_uri(operation),
            client_id=config.GOOGLE_CLIENT_ID,
            post_oauth_redirect_uri=post_oauth_redirect_uri,
        ).model_dump(mode="json"),
        algorithm=config.JWT_ALGORITHM,
        key=config.JWT_SIGNING_KEY,
    )

    auth_url = await google_oauth2_manager.create_authorization_url(
        redirect_uri=_get_google_redirect_uri(operation),
        state=oauth2_state_jwt,
        code_verifier=code_verifier,
    )

    return auth_url


async def exchange_google_userinfo(
    operation: AuthOperation, code: str, oauth2_state: OAuth2State
) -> GoogleUserInfo:
    """
    This function is used to get the user info from Google.
    It exchanges the code for the access token and then verifies the token.
    Then it returns the user info.
    """
    # Verify the info
    if (
        oauth2_state.client_id != config.GOOGLE_CLIENT_ID
        or oauth2_state.redirect_uri != _get_google_redirect_uri(operation)
    ):
        raise OAuth2Error(message="Error during OAuth2 flow")

    # Fetch the access token
    token_payload = await google_oauth2_manager.fetch_token(
        redirect_uri=oauth2_state.redirect_uri,
        code=code,
        code_verifier=oauth2_state.code_verifier,
    )

    # Create request object for token verification
    request: Request = Request()  # type: ignore[no-untyped-call]
    claims = id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]
        token_payload["id_token"],
        request,
        audience=config.GOOGLE_CLIENT_ID,
    )

    return GoogleUserInfo(
        name=claims["name"],
        email=claims["email"],
    )
