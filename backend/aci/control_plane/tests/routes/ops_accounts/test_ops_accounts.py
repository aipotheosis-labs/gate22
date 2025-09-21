from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, patch

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
@pytest.mark.parametrize("is_synced_before", [True, False])
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
@patch("aci.control_plane.routes.ops_accounts.MCPToolsManager")
def test_create_ops_account(
    mock_mcp_tools_manager_class: AsyncMock,
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
    is_synced_before: bool,
) -> None:
    # Set up the mock
    mock_mcp_tools_manager_instance = AsyncMock()
    mock_mcp_tools_manager_class.return_value = mock_mcp_tools_manager_instance

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

    # Set last_synced_at based on is_synced_before parameter
    dummy_mcp_server.last_synced_at = datetime.now() if is_synced_before else None

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

    if auth_type in [AuthType.API_KEY, AuthType.NO_AUTH]:
        if not is_synced_before:
            mock_mcp_tools_manager_instance.refresh_mcp_tools.assert_called_once()
        else:
            mock_mcp_tools_manager_instance.refresh_mcp_tools.assert_not_called()
