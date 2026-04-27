import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

MARIADB_SECRET_KEY = os.getenv("MARIADB_SECRET_KEY")
DB_USER_ENC = os.getenv("DB_USER_ENC")
DB_PASS_ENC = os.getenv("DB_PASS_ENC")
DB_HOST_ENC = os.getenv("DB_HOST_ENC")
DB_NAME_ENC = os.getenv("DB_NAME_ENC")
DB_PORT = os.getenv("DB_PORT", "6743")

if not all([MARIADB_SECRET_KEY, DB_USER_ENC, DB_PASS_ENC, DB_HOST_ENC, DB_NAME_ENC]):
    raise ValueError("🚨 데이터베이스 암호화 접속 정보(.env)가 누락되었습니다.")

try:
    fernet = Fernet(MARIADB_SECRET_KEY.encode('utf-8'))
    DB_USER = fernet.decrypt(DB_USER_ENC.encode('utf-8')).decode('utf-8')
    DB_PASS = fernet.decrypt(DB_PASS_ENC.encode('utf-8')).decode('utf-8')
    DB_HOST = fernet.decrypt(DB_HOST_ENC.encode('utf-8')).decode('utf-8')
    DB_NAME = fernet.decrypt(DB_NAME_ENC.encode('utf-8')).decode('utf-8')

    if os.getenv("LOCAL_DEV") == "true":
        DB_HOST = "test_db_host"
        DB_NAME = "test_db_name"

except Exception as e:
    raise ValueError(f"🚨 DB 접속 정보 복호화 실패: {e}")

print(f"🚀 [디버그] 파이썬 앱이 접속 중인 DB -> HOST: {DB_HOST} / DB: {DB_NAME}", flush=True)

DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

engine = create_async_engine(
    DATABASE_URL, 
    echo=False,
    pool_pre_ping=True,
    pool_recycle=3600
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()