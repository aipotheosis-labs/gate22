from aci.common.utils import check_and_get_env_variable, construct_db_url

# FastAPI APP CONFIG
APP_TITLE = "ACI Control Plane"
APP_DOCS_URL = "/v1/control-plane-docs"
APP_REDOC_URL = "/v1/control-plane-redoc"
APP_OPENAPI_URL = "/v1/control-plane-openapi.json"


ENVIRONMENT = check_and_get_env_variable("CONTROL_PLANE_ENVIRONMENT")
REDIRECT_URI_BASE = check_and_get_env_variable("CONTROL_PLANE_REDIRECT_URI_BASE")

# ROUTERS
ROUTER_PREFIX_HEALTH = "/v1/health"
ROUTER_PREFIX_AUTH = "/v1/auth"
ROUTER_PREFIX_ORGANIZATIONS = "/v1/organizations"
ROUTER_PREFIX_USERS = "/v1/users"
ROUTER_PREFIX_MCP_SERVERS = "/v1/mcp-servers"
ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS = "/v1/mcp-server-configurations"
ROUTER_PREFIX_CONNECTED_ACCOUNTS = "/v1/connected-accounts"
ROUTER_PREFIX_MCP_SERVER_BUNDLES = "/v1/mcp-server-bundles"
ROUTER_PREFIX_MCP = "/v1/mcp"

# Frontend
FRONTEND_URL = check_and_get_env_variable("CONTROL_PLANE_FRONTEND_URL")

# Authentication
GOOGLE_CLIENT_ID = check_and_get_env_variable("CONTROL_PLANE_GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = check_and_get_env_variable("CONTROL_PLANE_GOOGLE_CLIENT_SECRET")
GOOGLE_OAUTH_REDIRECT_URI_BASE = check_and_get_env_variable(
    "CONTROL_PLANE_GOOGLE_OAUTH_REDIRECT_URI_BASE"
)
SESSION_SECRET_KEY = check_and_get_env_variable("CONTROL_PLANE_SESSION_SECRET_KEY")
REFRESH_TOKEN_KEY = check_and_get_env_variable("CONTROL_PLANE_REFRESH_TOKEN_KEY")
JWT_SIGNING_KEY = check_and_get_env_variable("CONTROL_PLANE_JWT_SIGNING_KEY")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 1440


# DB CONFIG
DB_SCHEME = check_and_get_env_variable("CONTROL_PLANE_DB_SCHEME")
DB_USER = check_and_get_env_variable("CONTROL_PLANE_DB_USER")
DB_PASSWORD = check_and_get_env_variable("CONTROL_PLANE_DB_PASSWORD")
DB_HOST = check_and_get_env_variable("CONTROL_PLANE_DB_HOST")
DB_PORT = check_and_get_env_variable("CONTROL_PLANE_DB_PORT")
DB_NAME = check_and_get_env_variable("CONTROL_PLANE_DB_NAME")
DB_FULL_URL = construct_db_url(DB_SCHEME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)

# LLM
OPENAI_API_KEY = check_and_get_env_variable("CONTROL_PLANE_OPENAI_API_KEY")
