import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import ConnectedAccount, MCPServerConfiguration, Team, User
from aci.common.enums import AuthType
from aci.common.logging_setup import get_logger
from aci.common.schemas.connected_account import (
    ConnectedAccountCreate,
    ConnectedAccountPublic,
    OAuth2ConnectedAccountCreateResponse,
)
from aci.common.schemas.pagination import PaginationResponse

logger = get_logger(__name__)


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_member",
    ],
)
@pytest.mark.parametrize("is_team_allowed_by_config", [True, False])
@pytest.mark.parametrize("auth_type", [AuthType.API_KEY, AuthType.NO_AUTH, AuthType.OAUTH2])
@pytest.mark.parametrize("api_key", [None, "dummy_api_key"])
def test_create_connected_account(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    auth_type: AuthType,
    api_key: str | None,
    dummy_team: Team,
    dummy_user: User,
    access_token_fixture: str,
    dummy_mcp_server_configuration: MCPServerConfiguration,
    is_team_allowed_by_config: bool,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    # dummy_mcp_server_configurations has 2 dummy MCP server configurations, both without team
    config_added_to_team = dummy_mcp_server_configuration
    if is_team_allowed_by_config:
        config_added_to_team.allowed_teams = [dummy_team.id]
    else:
        config_added_to_team.allowed_teams = []

    config_added_to_team.auth_type = auth_type
    db_session.commit()

    body = ConnectedAccountCreate(
        mcp_server_configuration_id=dummy_mcp_server_configuration.id,
        api_key=api_key,
        redirect_url_after_account_creation="some_random_url",
    )

    response = test_client.post(
        "/v1/connected-accounts",
        headers={"Authorization": f"Bearer {access_token}"},
        json=body.model_dump(mode="json"),
    )

    if access_token_fixture == "dummy_access_token_no_orgs":
        assert response.status_code == 403
        return

    elif access_token_fixture == "dummy_access_token_member":
        # if not allowed to add to team, should return 403
        if not is_team_allowed_by_config:
            assert response.status_code == 403
            assert response.json()["error"].startswith("Not permitted")

        else:
            # assert input check
            if auth_type == AuthType.OAUTH2:
                assert response.status_code == 200
                oauth2_response = OAuth2ConnectedAccountCreateResponse.model_validate(
                    response.json()
                )
                assert oauth2_response.authorization_url.startswith("https://")

            elif auth_type == AuthType.API_KEY:
                if not api_key:
                    assert response.status_code == 400
                    return

                assert response.status_code == 200
                connected_account = ConnectedAccountPublic.model_validate(response.json())
                assert (
                    connected_account.mcp_server_configuration.id
                    == dummy_mcp_server_configuration.id
                )

            elif auth_type == AuthType.NO_AUTH:
                assert response.status_code == 200
                connected_account = ConnectedAccountPublic.model_validate(response.json())
                assert (
                    connected_account.mcp_server_configuration.id
                    == dummy_mcp_server_configuration.id
                )
                assert connected_account.user_id == dummy_user.id
    else:
        raise Exception("Untested access token fixture")


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
        "/v1/connected-accounts",
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
        f"/v1/connected-accounts/{target_connected_account.id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    if access_token_fixture in ["dummy_access_token_no_orgs", "dummy_access_token_another_org"]:
        assert response.status_code == 403
        return

    # Admin cannot delete anyone's connected account
    elif access_token_fixture == "dummy_access_token_admin":
        assert response.status_code == 403
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
