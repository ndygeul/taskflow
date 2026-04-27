from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from app.core.database import engine, Base
from app.routers import setup_routers
import json
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield

app = FastAPI(
    title="TaskFlow - Server Admin Portal",
    description="Team Work Portal for Server Administrators",
    version="1.0.0",
    lifespan=lifespan
)

BASE_DIR = Path(__file__).resolve().parent.parent

CONFIG_FILE = Path(__file__).resolve().parent / "monitoring_config.json"
monitoring_path = str(BASE_DIR / "scripts" / "ansible" / "result")

if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
            monitoring_path = config.get("ansible_result_path", monitoring_path)
            print(f"✅ 모니터링 설정 로드됨: {monitoring_path}")
    except Exception as e:
        print(f"⚠️ 설정 파일 읽기 실패 (기본값 사용): {e}")

SCRIPTS_DIR = str(BASE_DIR / "scripts")
if os.path.exists(SCRIPTS_DIR):
    app.mount("/monitoring/scripts", StaticFiles(directory=SCRIPTS_DIR), name="monitoring_scripts")
    print(f"✅ 스크립트 로그 경로 마운트: {SCRIPTS_DIR} -> /monitoring/scripts")
else:
    print(f"❌ 경로 없음: {SCRIPTS_DIR}")

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

UPLOADS_DIR = str(BASE_DIR / "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

setup_routers(app)

@app.get("/")
async def read_root(request: Request):
    """메인 포털 인덱스 페이지 렌더링"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    """L4 스위치 및 컨테이너 오케스트레이터(Docker/K8s)용 상태 점검 API"""
    return {"status": "ok"}