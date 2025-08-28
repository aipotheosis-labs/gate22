import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServer, MCPServerConfiguration, Team
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationPublicBasic,
)
from aci.common.schemas.pagination import PaginationResponse


@pytest.mark.parametrize(
    "access_token_fixture",
    [
        "dummy_access_token_no_orgs",
        "dummy_access_token_admin",
        "dummy_access_token_member",
        "dummy_access_token_admin_act_as_member",
    ],
)
@pytest.mark.parametrize("is_added_to_team", [True, False])
@pytest.mark.parametrize("offset", [None, 0, 10])
def test_list_mcp_server_configurations(
    test_client: TestClient,
    db_session: Session,
    request: pytest.FixtureRequest,
    access_token_fixture: str,
    dummy_mcp_server_configuration: MCPServerConfiguration,
    dummy_mcp_server: MCPServer,
    dummy_team: Team,
    is_added_to_team: bool,
    offset: int | None,
) -> None:
    access_token = request.getfixturevalue(access_token_fixture)

    if is_added_to_team:
        dummy_mcp_server_configuration.allowed_teams = [dummy_team.id]
    else:
        dummy_mcp_server_configuration.allowed_teams = []
    db_session.commit()

    params = {}
    if offset is not None:
        params["offset"] = offset

    response = test_client.get(
        "/v1/mcp-server-configurations",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
    )

    if access_token_fixture in ["dummy_access_token_no_orgs", "dummy_access_token_non_member"]:
        assert response.status_code == 403
        return

    paginated_response = PaginationResponse[MCPServerConfigurationPublicBasic].model_validate(
        response.json(),
    )

    assert paginated_response.offset == (offset if offset is not None else 0)

    if offset is None or offset == 0:
        if access_token_fixture == "dummy_access_token_admin":
            # Should see all the MCP server configurations, regardless of allowed_teams
            assert response.status_code == 200
            assert len(paginated_response.data) == 1
            assert paginated_response.data[0].id == dummy_mcp_server_configuration.id
            assert paginated_response.data[0].mcp_server.id == dummy_mcp_server.id

        elif access_token_fixture in [
            "dummy_access_token_member",
            "dummy_access_token_admin_act_as_member",
        ]:
            # Should only see the MCP server configuration that the user belongs to
            assert response.status_code == 200
            if is_added_to_team:
                # Should see 1 mcp server configuration as it is added to the user's teams
                assert len(paginated_response.data) == 1
                assert paginated_response.data[0].id == dummy_mcp_server_configuration.id
                assert paginated_response.data[0].mcp_server.id == dummy_mcp_server.id
            else:
                # Should not see any MCP server configuration
                assert len(paginated_response.data) == 0

    else:
        # shows nothing because offset should be larger than the total test MCP server configs
        assert len(paginated_response.data) == 0
