import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import ConnectedAccount, MCPServerConfiguration, Team, User
from aci.common.enums import AuthType
from aci.common.logging_setup import get_logger
from aci.common.schemas.connected_account import (
    ConnectedAccountPublic,
)
from aci.common.schemas.pagination import PaginationResponse
from aci.control_plane import config

logger = get_logger(__name__)


@pytest.mark.parametrize("is_team_allowed_by_config", [True, False])
@pytest.mark.parametrize(
    ("auth_type", "api_key", "redirect_url_after_account_creation", "should_succeed"),
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
def test_create_connected_account(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    auth_type: AuthType,
    api_key: str | None,
    redirect_url_after_account_creation: str | None,
    should_succeed: bool,
    dummy_team: Team,
    dummy_user: User,
    dummy_access_token_member: str,
    dummy_mcp_server_configuration: MCPServerConfiguration,
    is_team_allowed_by_config: bool,
) -> None:
    # dummy_mcp_server_configurations has 2 dummy MCP server configurations, both without team
    config_added_to_team = dummy_mcp_server_configuration
    if is_team_allowed_by_config:
        config_added_to_team.allowed_teams = [dummy_team.id]
    else:
        config_added_to_team.allowed_teams = []

    config_added_to_team.auth_type = auth_type
    db_session.commit()

    body = {}
    if api_key is not None:
        body["api_key"] = api_key
    if redirect_url_after_account_creation is not None:
        body["redirect_url_after_account_creation"] = redirect_url_after_account_creation
    body["mcp_server_configuration_id"] = str(dummy_mcp_server_configuration.id)

    response = test_client.post(
        config.ROUTER_PREFIX_CONNECTED_ACCOUNTS,
        headers={"Authorization": f"Bearer {dummy_access_token_member}"},
        json=body,
    )

    # if not allowed to add to team, should return 403
    if not is_team_allowed_by_config:
        assert response.status_code == 403
        assert response.json()["error"].startswith("Not permitted")

    else:
        # assert input check
        if should_succeed:
            assert response.status_code == 200
        else:
            assert response.status_code == 400


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_connected_accounts(
    test_client: TestClient,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_user: User,
    dummy_connected_accounts: list[ConnectedAccount],
    offset: int | None,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    params = {}
    if offset is not None:
        params["offset"] = offset

    response = test_client.get(
        config.ROUTER_PREFIX_CONNECTED_ACCOUNTS,
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
    )

    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    paginated_response = PaginationResponse[ConnectedAccountPublic].model_validate(
        response.json(),
    )

    assert paginated_response.offset == (offset if offset is not None else 0)

    if offset is None or offset == 0:
        if access_token_fixture == "dummy_access_token_admin":
            # Should see all the connected accounts in the organization
            assert response.status_code == 200
            assert len(paginated_response.data) == len(dummy_connected_accounts)

        elif access_token_fixture in [
            "dummy_access_token_member",
            "dummy_access_token_admin_act_as_member",
        ]:
            # Should only see the connected accounts that the user has
            assert response.status_code == 200
            assert len(paginated_response.data) == 2
            assert all(
                response_item.user_id == dummy_user.id for response_item in paginated_response.data
            )
        else:
            raise Exception("Untested access token fixture")
    else:
        # shows nothing because offset should be larger than the total test MCP server configs
        assert len(paginated_response.data) == 0


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
        "dummy_access_token_another_org",
    ],
)
@pytest.mark.parametrize("delete_own_connected_account", [True, False])
def test_delete_connected_account(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_connected_accounts: list[ConnectedAccount],
    delete_own_connected_account: bool,
    dummy_user: User,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # Find the target connected account for testing
    if delete_own_connected_account:
        target_connected_account = next(
            connected_account
            for connected_account in dummy_connected_accounts
            if connected_account.user_id == dummy_user.id
        )
    else:
        target_connected_account = next(
            connected_account
            for connected_account in dummy_connected_accounts
            if connected_account.user_id != dummy_user.id
        )

    db_session.commit()

    response = test_client.delete(
        f"{config.ROUTER_PREFIX_CONNECTED_ACCOUNTS}/{target_connected_account.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if access_token_fixture in ["dummy_access_token_no_orgs", "dummy_access_token_another_org"]:
        assert response.status_code == 403
        return

    # Admin can delete anyone's connected account
    elif access_token_fixture == "dummy_access_token_admin":
        assert response.status_code == 200

        # Check if the connected account is deleted
        connected_account = crud.connected_accounts.get_connected_account_by_id(
            db_session, target_connected_account.id
        )
        assert connected_account is None
        return

    # Member can delete their own connected account
    elif access_token_fixture in [
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ]:
        if delete_own_connected_account:
            assert response.status_code == 200

            # Check if the connected account is deleted
            connected_account = crud.connected_accounts.get_connected_account_by_id(
                db_session, target_connected_account.id
            )
            assert connected_account is None

        else:
            assert response.status_code == 403
            # Check if the connected account is deleted
            connected_account = crud.connected_accounts.get_connected_account_by_id(
                db_session, target_connected_account.id
            )
            assert connected_account is not None

    else:
        raise Exception("Untested access token fixture")
