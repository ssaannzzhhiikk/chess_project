from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import settings
from .middleware.pro_access import enforce_pro_access

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(enforce_pro_access)

app.include_router(router)


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
