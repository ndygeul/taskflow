from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import shutil
import os
import uuid
from pathlib import Path

router = APIRouter(tags=["upload"])

BASE_UPLOAD_DIR = Path("/app/uploads")

@router.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    context: str = Form(...)
):
    try:
        safe_context = os.path.basename(context)
        save_dir = BASE_UPLOAD_DIR / safe_context
        save_dir.mkdir(parents=True, exist_ok=True)
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = save_dir / unique_filename

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {
            "url": f"/uploads/{safe_context}/{unique_filename}",
            "original_name": file.filename,
            "filename": unique_filename
        }
        
    except Exception as e:
        print(f"❌ Upload Failed: {e}")
        raise HTTPException(status_code=500, detail=f"파일 업로드 실패: {str(e)}")

@router.get("/api/download/{context}/{filename}")
async def download_file(context: str, filename: str):
    file_path = BASE_UPLOAD_DIR / context / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(path=file_path, filename=filename)
