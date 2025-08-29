# ACI CLI

## Example Usage

### Upsert an MCP Server
```bash
docker compose exec runner python -m aci.cli upsert-mcp-server --mcp-server-file ./mcp_servers/notion/server.json --secrets-file ./mcp_servers/notion/.secrets.json
```

### Upsert MCP Tools
```bash
docker compose exec runner python -m aci.cli upsert-mcp-tools --mcp-tools-file ./mcp_servers/notion/tools.json
```

#### Create a mock organization, teams and users setting
```bash
docker compose exec runner python -m aci.cli create-mock-org-teams-users
```
