from aci.common.utils import check_and_get_env_variable, construct_db_url

# FastAPI APP CONFIG
APP_TITLE = "ACI Control Plane"
APP_DOCS_URL = "/v1/control-plane-docs"
APP_REDOC_URL = "/v1/control-plane-redoc"
APP_OPENAPI_URL = "/v1/control-plane-openapi.json"


ENVIRONMENT = check_and_get_env_variable("CONTROL_PLANE_ENVIRONMENT")

# ROUTERS
ROUTER_PREFIX_HEALTH = "/v1/health"
ROUTER_PREFIX_AUTH = "/v1/auth"
ROUTER_PREFIX_ORGANIZATIONS = "/v1/organizations"
ROUTER_PREFIX_USERS = "/v1/users"

# Authentication
# GOOGLE_CLIENT_ID = check_and_get_env_variable("CONTROL_PLANE_GOOGLE_CLIENT_ID")
# GOOGLE_CLIENT_SECRET = check_and_get_env_variable("CONTROL_PLANE_GOOGLE_CLIENT_SECRET")
SESSION_SECRET_KEY = check_and_get_env_variable("CONTROL_PLANE_SESSION_SECRET_KEY")
JWT_SIGNING_KEY = check_and_get_env_variable("CONTROL_PLANE_JWT_SIGNING_KEY")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 1440

# Frontend
FRONTEND_URL = check_and_get_env_variable("CONTROL_PLANE_FRONTEND_URL")

# DB CONFIG
DB_SCHEME = check_and_get_env_variable("CONTROL_PLANE_DB_SCHEME")
DB_USER = check_and_get_env_variable("CONTROL_PLANE_DB_USER")
DB_PASSWORD = check_and_get_env_variable("CONTROL_PLANE_DB_PASSWORD")
DB_HOST = check_and_get_env_variable("CONTROL_PLANE_DB_HOST")
DB_PORT = check_and_get_env_variable("CONTROL_PLANE_DB_PORT")
DB_NAME = check_and_get_env_variable("CONTROL_PLANE_DB_NAME")
DB_FULL_URL = construct_db_url(DB_SCHEME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)
