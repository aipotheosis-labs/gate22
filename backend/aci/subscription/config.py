from aci.common.enums import Environment
from aci.common.utils import check_and_get_env_variable, construct_db_url

# FastAPI APP CONFIG
APP_TITLE = "ACI Subscription"
APP_ROOT_PATH = "/subscription"
APP_DOCS_URL = "/docs"
APP_REDOC_URL = "/redoc"
APP_OPENAPI_URL = "/openapi.json"


ENVIRONMENT = Environment(check_and_get_env_variable("SUBSCRIPTION_ENVIRONMENT"))
LOG_LEVEL = check_and_get_env_variable("SUBSCRIPTION_LOG_LEVEL", default="INFO")

# ROUTERS
ROUTER_PREFIX_HEALTH = "/health"
ROUTER_PREFIX_ORGANIZATIONS = "/organizations"
ROUTER_PREFIX_STRIPE = "/stripe"


# DB CONFIG
DB_SCHEME = check_and_get_env_variable("SUBSCRIPTION_DB_SCHEME")
DB_USER = check_and_get_env_variable("SUBSCRIPTION_DB_USER")
DB_PASSWORD = check_and_get_env_variable("SUBSCRIPTION_DB_PASSWORD")
DB_HOST = check_and_get_env_variable("SUBSCRIPTION_DB_HOST")
DB_PORT = check_and_get_env_variable("SUBSCRIPTION_DB_PORT")
DB_NAME = check_and_get_env_variable("SUBSCRIPTION_DB_NAME")
DB_FULL_URL = construct_db_url(DB_SCHEME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)

STRIPE_SECRET_KEY = check_and_get_env_variable("SUBSCRIPTION_STRIPE_SECRET_KEY")

# 8KB
MAX_LOG_FIELD_SIZE = 8 * 1024

# Ops
SENTRY_DSN = check_and_get_env_variable("SUBSCRIPTION_SENTRY_DSN")
