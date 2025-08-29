from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from pythonjsonlogger.json import JsonFormatter
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from aci.common.logging_setup import setup_logging
from aci.control_plane import config
from aci.control_plane.exceptions import ControlPlaneException
from aci.control_plane.middleware.interceptor import (
    InterceptorMiddleware,
    RequestContextFilter,
)
from aci.control_plane.routes import (
    auth,
    connected_accounts,
    health,
    mcp_server_bundles,
    mcp_server_configurations,
    mcp_servers,
    organizations,
    users,
)
from aci.control_plane.routes.mcp import route

if config.ENVIRONMENT == "local":
    formatter = None
else:
    formatter = JsonFormatter(
        "{levelname} {asctime} {name} {message}",
        style="{",
        rename_fields={"asctime": "timestamp", "name": "file", "levelname": "level"},
    )

setup_logging(
    formatter=formatter,
    filters=[RequestContextFilter()],
)


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(
    title=config.APP_TITLE,
    docs_url=config.APP_DOCS_URL,
    redoc_url=config.APP_REDOC_URL,
    openapi_url=config.APP_OPENAPI_URL,
    generate_unique_id_function=custom_generate_unique_id,
)


@app.exception_handler(ControlPlaneException)
async def global_exception_handler(request: Request, exc: ControlPlaneException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.error_code,
        content={"error": f"{exc.title}, {exc.message}" if exc.message else exc.title},
    )


app.add_middleware(
    SessionMiddleware,
    secret_key=config.SESSION_SECRET_KEY,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(InterceptorMiddleware)


app.include_router(
    health.router,
    prefix=config.ROUTER_PREFIX_HEALTH,
    tags=[config.ROUTER_PREFIX_HEALTH.split("/")[-1]],
)

app.include_router(
    auth.router,
    prefix=config.ROUTER_PREFIX_AUTH,
    tags=[config.ROUTER_PREFIX_AUTH.split("/")[-1]],
)

app.include_router(
    users.router,
    prefix=config.ROUTER_PREFIX_USERS,
    tags=[config.ROUTER_PREFIX_USERS.split("/")[-1]],
)

app.include_router(
    organizations.router,
    prefix=config.ROUTER_PREFIX_ORGANIZATIONS,
    tags=[config.ROUTER_PREFIX_ORGANIZATIONS.split("/")[-1]],
)

app.include_router(
    mcp_servers.router,
    prefix=config.ROUTER_PREFIX_MCP_SERVERS,
    tags=[config.ROUTER_PREFIX_MCP_SERVERS.split("/")[-1]],
)

app.include_router(
    mcp_server_configurations.router,
    prefix=config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS,
    tags=[config.ROUTER_PREFIX_MCP_SERVER_CONFIGURATIONS.split("/")[-1]],
)

app.include_router(
    connected_accounts.router,
    prefix=config.ROUTER_PREFIX_CONNECTED_ACCOUNTS,
    tags=[config.ROUTER_PREFIX_CONNECTED_ACCOUNTS.split("/")[-1]],
)

app.include_router(
    mcp_server_bundles.router,
    prefix=config.ROUTER_PREFIX_MCP_SERVER_BUNDLES,
    tags=[config.ROUTER_PREFIX_MCP_SERVER_BUNDLES.split("/")[-1]],
)

app.include_router(
    route.router,
    prefix=config.ROUTER_PREFIX_MCP,
    tags=[config.ROUTER_PREFIX_MCP.split("/")[-1]],
)
