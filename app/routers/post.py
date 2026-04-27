from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.board import Board, Post
from app.schemas import PostCreate, PostResponse, PostListResponse, PostAuth
from app.core.security import get_password_hash, verify_password
from datetime import datetime
import re
import os
from pathlib import Path
from urllib.parse import unquote

router = APIRouter(prefix="/api/posts", tags=["posts"])
UPLOAD_DIR = Path("/app/uploads")

@router.get("/{board_code}", response_model=list[PostListResponse])
async def get_posts(board_code: str, db: AsyncSession = Depends(get_db)):
    board_res = await db.execute(select(Board).where(Board.code == board_code))
    board = board_res.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")
    
    result = await db.execute(
        select(Post)
        .where(Post.board_id == board.id)
        .order_by(Post.is_notice.desc(), Post.created_at.desc())
    )
    return result.scalars().all()

@router.post("/{board_code}", response_model=PostResponse)
async def create_post(board_code: str, post: PostCreate, request: Request, db: AsyncSession = Depends(get_db)):
    board_res = await db.execute(select(Board).where(Board.code == board_code))
    board = board_res.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="게시판을 찾을 수 없습니다.")

    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0]
    else:
        client_ip = request.client.host if request.client else None

    new_post = Post(
        board_id=board.id,
        title=post.title,
        content=post.content,
        writer=post.writer,
        password=get_password_hash(post.password),
        is_secret=post.is_secret,
        is_notice=post.is_notice,
        category=post.category,
        created_at=datetime.now(),
        ip_address=client_ip
    )
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)
    return new_post

@router.get("/detail/{post_id}", response_model=PostResponse)
async def get_post_detail(post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post: raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
    post.view_count += 1
    await db.commit()
    await db.refresh(post)
    return post

@router.get("/{post_id}/navigation")
async def get_post_navigation(post_id: int, db: AsyncSession = Depends(get_db)):
    current_post = await db.get(Post, post_id)
    if not current_post: return {}
    prev_stmt = select(Post.id, Post.title).where(Post.board_id == current_post.board_id, Post.id < post_id).order_by(Post.id.desc()).limit(1)
    prev_post = (await db.execute(prev_stmt)).first()
    next_stmt = select(Post.id, Post.title).where(Post.board_id == current_post.board_id, Post.id > post_id).order_by(Post.id.asc()).limit(1)
    next_post = (await db.execute(next_stmt)).first()
    return {"prev": {"id": prev_post.id, "title": prev_post.title} if prev_post else None, "next": {"id": next_post.id, "title": next_post.title} if next_post else None}

@router.put("/{post_id}")
async def update_post(post_id: int, post_data: PostCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post: raise HTTPException(status_code=404, detail="게시글이 없습니다.")

    if not verify_password(post_data.password, post.password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")

    old_files = set()
    if post.content:
        old_files = set(re.findall(r'/uploads/([^"\']+)', post.content))
        
    new_files = set()
    if post_data.content:
        new_files = set(re.findall(r'/uploads/([^"\']+)', post_data.content))

    deleted_files = old_files - new_files

    for filename in deleted_files:
        try:
            decoded_filename = unquote(filename).split("?")[0].split("#")[0]
            file_path = UPLOAD_DIR / decoded_filename
            if file_path.exists(): 
                os.remove(file_path)
        except Exception as e:
            print(f"첨부파일 삭제 오류: {e}") 
            pass

    post.title = post_data.title
    post.content = post_data.content
    post.writer = post_data.writer
    post.is_secret = post_data.is_secret
    post.is_notice = post_data.is_notice
    post.category = post_data.category
    
    await db.commit()
    await db.refresh(post)
    return post

@router.delete("/{post_id}")
async def delete_post(post_id: int, auth: PostAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post: raise HTTPException(status_code=404, detail="게시글이 없습니다.")

    if not verify_password(auth.password, post.password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")
        
    if post.content:
        try:
            files = re.findall(r'/uploads/([^"\']+)', post.content)
            for filename in files:
                decoded_filename = unquote(filename).split("?")[0].split("#")[0]
                file_path = UPLOAD_DIR / decoded_filename
                if file_path.exists(): os.remove(file_path)
        except Exception: pass
    await db.delete(post)
    await db.commit()
    return {"message": "삭제되었습니다."}
