from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from app.core.database import get_db
from app.models.board import Board, Menu
from app.models.config import SystemConfig
from app.schemas import (
    BoardCreate, 
    BoardResponse, 
    MenuWithBoardsResponse, 
    MenuStructureResponse, 
    MenuResponse
)
import shutil
from pathlib import Path
import os

router = APIRouter(prefix="/api/boards", tags=["boards"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/", response_model=BoardResponse)
async def create_board(req: BoardCreate, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(Board).where(Board.code == req.code))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 존재하는 게시판 코드입니다.")

    new_board = Board(
        name=req.name,
        code=req.code,
        description=req.description,
        category_list=req.category_list,
        order_no=99,
        is_visible=True
    )

    db.add(new_board)
    await db.commit()
    await db.refresh(new_board)

    try:
        UPLOAD_BASE_DIR = Path("/app/uploads")
        board_dir = UPLOAD_BASE_DIR / req.code

        board_dir.mkdir(parents=True, exist_ok=True)

        os.chmod(board_dir, 0o777)

        print(f"✅ 게시판 폴더 생성 완료: {board_dir}")

    except Exception as e:
        print(f"⚠️ 게시판 폴더 생성 실패: {e}")
    # =========================================================

    return new_board

@router.get("/", response_model=list[BoardResponse])
async def get_boards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Board).order_by(Board.order_no))
    return result.scalars().all()

@router.get("/structure")
async def get_board_structure(db: AsyncSession = Depends(get_db)):
    menus_res = await db.execute(select(Menu).order_by(Menu.order_no))
    menus = menus_res.scalars().all()
    
    menu_list = []
    for menu in menus:
        boards_res = await db.execute(
            select(Board)
            .where(Board.menu_id == menu.id)
            .order_by(Board.order_no)
        )
        boards = boards_res.scalars().all()
        
        menu_basic = MenuResponse.model_validate(menu)
        menu_data = MenuWithBoardsResponse(
            id=menu_basic.id,
            name=menu_basic.name,
            code=menu_basic.code,
            order_no=menu_basic.order_no,
            boards=[BoardResponse.model_validate(b) for b in boards]
        )
        menu_list.append(menu_data)
        
    orphans_res = await db.execute(select(Board).where(Board.menu_id == None).order_by(Board.order_no))
    orphans = orphans_res.scalars().all()
    
    return MenuStructureResponse(
        menus=menu_list,
        orphans=[BoardResponse.model_validate(b) for b in orphans]
    )

class DeleteRequest(BaseModel):
    password: str

@router.delete("/{board_code}")
async def delete_board(
    board_code: str,
    req: DeleteRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "admin_password"))
    config = result.scalar_one_or_none()

    if not config or not pwd_context.verify(req.password, config.value):
        raise HTTPException(status_code=403, detail="마스터 비밀번호가 일치하지 않습니다.")

    result = await db.execute(select(Board).where(Board.code == board_code))
    board = result.scalar_one_or_none()

    if not board:
        raise HTTPException(status_code=404, detail="삭제할 대상을 찾을 수 없습니다.")

    await db.delete(board)
    await db.commit()

    try:
        base_upload_dir = Path("/app/uploads")
        target_dir = base_upload_dir / board_code

        if target_dir.exists() and target_dir.is_dir():
            shutil.rmtree(target_dir)
            print(f"✅ 게시판 폴더 삭제 완료: {target_dir}")
        else:
            print(f"⚠️ 삭제할 폴더가 없음 (또는 이미 삭제됨): {target_dir}")

    except Exception as e:
        print(f"❌ 게시판 폴더 삭제 실패: {e}")
    # =========================================================

    return {"msg": "삭제되었습니다."}
