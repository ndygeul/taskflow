from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from app.core.database import get_db
from app.models.config import SystemConfig
from app.models.board import Menu, Board
from app.schemas import (
    MenuCreate, MenuUpdateOrder, MenuResponse, 
    BoardUpdateMenu, BoardUpdateOrder, BoardUpdateVisibility, BoardUpdate,
    PostMoveCopyRequest, PostBulkDeleteRequest,
    MenuUrlCreateRequest, MenuUrlUpdateRequest
)
from pydantic import BaseModel
from passlib.context import CryptContext
from typing import Optional
import time
import shutil
from pathlib import Path
import os

router = APIRouter(prefix="/api/admin", tags=["admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

UPLOAD_BASE_DIR = Path("/app/uploads")

class AdminInitRequest(BaseModel):
    password: str
    confirm_password: str

class AdminLoginRequest(BaseModel):
    password: str

class AdminChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

@router.get("/status")
async def check_admin_status(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "admin_password"))
    config = result.scalar_one_or_none()
    is_initialized = config is not None
    is_logged_in = request.cookies.get("admin_token") == "authenticated"
    return {"is_initialized": is_initialized, "is_logged_in": is_logged_in}

@router.post("/init")
async def init_admin_password(req: AdminInitRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "admin_password"))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 관리자 비밀번호가 설정되어 있습니다.")

    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="비밀번호가 일치하지 않습니다.")

    hashed_password = pwd_context.hash(req.password)
    new_config = SystemConfig(key="admin_password", value=hashed_password)
    db.add(new_config)
    await db.commit()
    
    return {"message": "관리자 비밀번호가 설정되었습니다."}

@router.post("/login")
async def admin_login(req: AdminLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "admin_password"))
    config = result.scalar_one_or_none()

    if not config or not pwd_context.verify(req.password, config.value):
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")

    response.set_cookie(key="admin_token", value="authenticated", httponly=True, max_age=3600)
    return {"message": "로그인 성공"}

@router.post("/logout")
async def admin_logout(response: Response):
    response.delete_cookie("admin_token")
    return {"message": "로그아웃 되었습니다."}

@router.post("/change-password")
async def change_admin_password(req: AdminChangePasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == "admin_password"))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=400, detail="초기 설정이 되어있지 않습니다.")

    if not pwd_context.verify(req.current_password, config.value):
        raise HTTPException(status_code=401, detail="현재 비밀번호가 일치하지 않습니다.")

    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="새 비밀번호가 서로 일치하지 않습니다.")
    
    if req.current_password == req.new_password:
        raise HTTPException(status_code=400, detail="새 비밀번호는 현재 비밀번호와 달라야 합니다.")

    config.value = pwd_context.hash(req.new_password)
    await db.commit()

    return {"message": "관리자 비밀번호가 변경되었습니다."}

@router.get("/menus", response_model=list[MenuResponse])
async def get_admin_menus(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Menu).order_by(Menu.order_no))
    return result.scalars().all()

@router.post("/menus", response_model=MenuResponse)
async def create_menu(req: MenuCreate, db: AsyncSession = Depends(get_db)):
    exists = await db.execute(select(Menu).where(Menu.code == req.code))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 존재하는 메뉴 코드입니다.")
    
    max_order = await db.execute(select(func.max(Menu.order_no)))
    current_max = max_order.scalar() or 0
    
    new_menu = Menu(name=req.name, code=req.code, order_no=current_max + 1)
    db.add(new_menu)
    await db.commit()
    await db.refresh(new_menu)
    return new_menu

@router.post("/menus/url")
async def create_url_menu(req: MenuUrlCreateRequest, db: AsyncSession = Depends(get_db)):
    unique_code = f"link_{int(time.time())}"
    max_order = await db.execute(select(func.max(Board.order_no)))
    current_max = max_order.scalar() or 0

    new_board = Board(
        name=req.name,
        code=unique_code,
        menu_id=req.parent_id,
        url=req.url,
        is_external=req.is_external,
        icon="bi-link-45deg",
        order_no=current_max + 1,
        is_visible=True,
        type="link",
        is_sidebar=req.is_sidebar
    )

    db.add(new_board)
    await db.commit()
    return {"message": "메뉴가 생성되었습니다."}

@router.put("/menus/url/{board_id}")
async def update_url_menu(board_id: int, req: MenuUrlUpdateRequest, db: AsyncSession = Depends(get_db)):
    board = await db.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")

    board.name = req.name
    board.url = req.url
    board.is_external = req.is_external

    board.is_sidebar = req.is_sidebar
    if req.is_sidebar:
        board.menu_id = None

    await db.commit()
    return {"message": "수정되었습니다."}

@router.post("/menus/reorder")
async def reorder_menus(req: MenuUpdateOrder, db: AsyncSession = Depends(get_db)):
    for index, menu_id in enumerate(req.menu_ids):
        await db.execute(
            update(Menu).where(Menu.id == menu_id).values(order_no=index + 1)
        )
    await db.commit()
    return {"message": "순서가 저장되었습니다."}

@router.delete("/menus/{menu_id}")
async def delete_menu(menu_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(update(Board).where(Board.menu_id == menu_id).values(menu_id=None))
    await db.execute(delete(Menu).where(Menu.id == menu_id))
    await db.commit()
    return {"message": "메뉴가 삭제되었습니다."}

@router.put("/boards/{board_code}/menu")
async def update_board_menu(board_code: str, req: BoardUpdateMenu, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Board).where(Board.code == board_code))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    board.menu_id = req.menu_id
    
    if req.menu_id is not None:
        board.is_visible = True

    await db.commit()
    return {"message": "변경되었습니다."}

@router.post("/boards/reorder")
async def reorder_boards(req: BoardUpdateOrder, db: AsyncSession = Depends(get_db)):
    for index, board_id in enumerate(req.board_ids):
        await db.execute(
            update(Board).where(Board.id == board_id).values(order_no=index + 1)
        )
    await db.commit()
    return {"message": "게시판 순서가 저장되었습니다."}

@router.put("/boards/{board_id}/visibility")
async def update_board_visibility(board_id: int, req: BoardUpdateVisibility, db: AsyncSession = Depends(get_db)):
    board = await db.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    board.is_visible = req.is_visible
    await db.commit()
    return {"message": "상태가 변경되었습니다."}

@router.put("/boards/{board_id}")
async def update_board_info(board_id: int, req: BoardUpdate, db: AsyncSession = Depends(get_db)):
    board = await db.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")

    board.name = req.name
    if req.description is not None:
        board.description = req.description

    board.category_list = req.category_list
        
    await db.commit()
    return {"message": "게시판 정보가 수정되었습니다."}

@router.post("/posts/move")
async def move_posts(req: PostMoveCopyRequest, db: AsyncSession = Depends(get_db)):
    target_board = await db.get(Board, req.target_board_id)
    if not target_board:
        raise HTTPException(status_code=404, detail="대상 게시판을 찾을 수 없습니다.")
    
    await db.execute(
        update(Board.posts.property.mapper.class_)
        .where(Board.posts.property.mapper.class_.id.in_(req.post_ids))
        .values(board_id=req.target_board_id)
    )
    await db.commit()
    return {"message": f"{len(req.post_ids)}개의 게시글을 이동했습니다."}

@router.post("/posts/copy")
async def copy_posts(req: PostMoveCopyRequest, db: AsyncSession = Depends(get_db)):
    target_board = await db.get(Board, req.target_board_id)
    if not target_board:
        raise HTTPException(status_code=404, detail="대상 게시판을 찾을 수 없습니다.")

    PostModel = Board.posts.property.mapper.class_
    result = await db.execute(select(PostModel).where(PostModel.id.in_(req.post_ids)))
    posts = result.scalars().all()
    
    copied_count = 0
    for p in posts:
        new_post = PostModel(
            board_id=req.target_board_id,
            title=f"{p.title} (복사본)",
            content=p.content,
            writer=p.writer,
            password=p.password,
            is_secret=p.is_secret,
            is_notice=p.is_notice,
            ip_address=p.ip_address,
            category=p.category
        )
        db.add(new_post)
        copied_count += 1
    
    await db.commit()
    return {"message": f"{copied_count}개의 게시글을 복사했습니다."}

@router.post("/posts/bulk-delete")
async def bulk_delete_posts(req: PostBulkDeleteRequest, db: AsyncSession = Depends(get_db)):
    if not req.post_ids:
        raise HTTPException(status_code=400, detail="삭제할 게시글이 없습니다.")

    PostModel = Board.posts.property.mapper.class_
    await db.execute(
        delete(PostModel).where(PostModel.id.in_(req.post_ids))
    )
    await db.commit()
    return {"message": f"{len(req.post_ids)}개의 게시글을 삭제했습니다."}

@router.delete("/boards/{board_id}")
async def delete_board(board_id: int, db: AsyncSession = Depends(get_db)):
    """
    게시판을 삭제하고, 해당 게시판의 업로드 디렉토리(uploads/{code})도 함께 삭제합니다.
    """
    board = await db.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")

    target_code = board.code

    await db.delete(board)
    await db.commit()

    try:
        board_dir = UPLOAD_BASE_DIR / target_code

        print(f"🔍 [DEBUG] 삭제 시도 경로: {board_dir.absolute()}")

        if board_dir.exists() and board_dir.is_dir():
            shutil.rmtree(board_dir)
            print(f"✅ 게시판 폴더 삭제 완료: {board_dir}")
        else:
            print(f"⚠️ 폴더가 존재하지 않음: {board_dir}")

    except Exception as e:
        print(f"❌ 게시판 폴더 삭제 실패: {e}")

    return {"message": "게시판이 삭제되었습니다."}
