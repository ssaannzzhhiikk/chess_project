from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import root_websocket_router, router
from .config import settings
from .middleware.pro_access import enforce_pro_access
from .middleware.rate_limit import enforce_rate_limits

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(enforce_pro_access)
app.middleware("http")(enforce_rate_limits)

app.include_router(router)
app.include_router(root_websocket_router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
