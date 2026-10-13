from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from database import ensure_indexes
from seed import run_seed
from routers.auth_router import router as auth_router
from routers.admin_router import router as admin_router
from routers.content_router import router as content_router
from routers.exam_router import router as exam_router
from routers.student_router import router as student_router
from routers.ai_router import router as ai_router
from routers.upload_router import router as upload_router

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ielts")

app = FastAPI(title="BePro IELTS API")

health = APIRouter(prefix="/api")


@health.get("/")
async def root():
    return {"message": "BePro IELTS API", "status": "ok"}


@health.get("/health")
async def health_check():
    return {"status": "healthy"}


app.include_router(health)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(content_router)
app.include_router(exam_router)
app.include_router(student_router)
app.include_router(ai_router)
app.include_router(upload_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
        await run_seed()
        logger.info("Startup complete: indexes + seed done.")
    except Exception as e:
        logger.error(f"Startup error: {e}")
