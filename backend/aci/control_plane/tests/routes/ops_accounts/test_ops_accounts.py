from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServer, Organization
from aci.common.enums import AuthType
from aci.common.logging_setup import get_logger
from aci.common.schemas.ops_account import OAuth2OpsAccountCreateResponse, OpsAccountPublic
from aci.control_plane import config

logger = get_logger(__name__)


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
@pytest.mark.parametrize("is_mcp_server_in_org", [True, False])
@pytest.mark.parametrize(
    ("auth_type", "api_key", "redirect_url_after_account_creation", "valid_input"),
    [
        (AuthType.API_KEY, "dummy_api_key", None, True),
        (AuthType.API_KEY, "dummy_api_key", "some_random_url", False),
        (AuthType.API_KEY, None, None, False),
        (AuthType.API_KEY, "", None, False),
        (AuthType.OAUTH2, None, "some_random_url", True),
        (AuthType.OAUTH2, None, None, True),
        (AuthType.OAUTH2, "dummy_api_key", None, False),
        (AuthType.NO_AUTH, None, None, True),
        (AuthType.NO_AUTH, "dummy_api_key", None, False),
        (AuthType.NO_AUTH, "dummy_api_key", "some_random_url", False),
    ],
)
def test_create_ops_account(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    auth_type: AuthType,
    api_key: str | None,
    redirect_url_after_account_creation: str | None,
    valid_input: bool,
    dummy_mcp_server: MCPServer,
    access_token_fixture: str,
    is_mcp_server_in_org: bool,
    dummy_organization: Organization,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    body: dict[str, Any] = {
        "auth_type": auth_type.value,
    }
    if api_key is not None:
        body["api_key"] = api_key
    if redirect_url_after_account_creation is not None:
        body["redirect_url_after_account_creation"] = redirect_url_after_account_creation
    body["mcp_server_id"] = str(dummy_mcp_server.id)

    if is_mcp_server_in_org:
        dummy_mcp_server.organization_id = dummy_organization.id
    else:
        dummy_mcp_server.organization_id = None
    db_session.commit()

    response = test_client.post(
        config.ROUTER_PREFIX_OPS_ACCOUNTS,
        headers={"Authorization": f"Bearer {access_token}"},
        json=body,
    )

    if not valid_input:
        assert response.status_code == 422
        return

    if access_token_fixture != "dummy_access_token_admin":
        assert response.status_code == 403
        return

    if not is_mcp_server_in_org:
        assert response.status_code == 403
        return

    # assert input check
    assert response.status_code == 200
    if auth_type == AuthType.API_KEY or auth_type == AuthType.NO_AUTH:
        assert OpsAccountPublic.model_validate(response.json()) is not None
    elif auth_type == AuthType.OAUTH2:
        assert OAuth2OpsAccountCreateResponse.model_validate(response.json()) is not None
