from fastapi import APIRouter, Request, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.models.board import Board, Post, Menu
from app.models.journal import Journal
from app.core.security import verify_password, get_password_hash
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import math
import json
from collections import defaultdict
import re  

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory="templates")

router = APIRouter(tags=["views"])

def get_preview_text(text: str, is_secret: bool = False, limit: int = 200) -> str:
    if is_secret:
        return "비밀글입니다."
    if not text:
        return ""
    clean_text = re.sub(r'<.*?>', ' ', text)
    clean_text = " ".join(clean_text.split())
    if len(clean_text) > limit:
        return clean_text[:limit] + "..."
    return clean_text

class PasswordRequest(BaseModel):
    password: str

async def get_menu_boards(db: AsyncSession):
    result = await db.execute(select(Board).order_by(Board.id))
    return result.scalars().all()

@router.post("/api/posts/{post_id}/verify")
async def verify_post_password(post_id: int, payload: PasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalars().first()
    if not post: raise HTTPException(status_code=404, detail="게시글 없음")
    
    if not verify_password(payload.password, post.password):
        raise HTTPException(status_code=400, detail="비밀번호 불일치")
    return {"message": "확인됨"}

@router.post("/api/posts/{post_id}/access")
async def access_post_password(post_id: int, payload: PasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalars().first()
    if not post: raise HTTPException(status_code=404, detail="게시글 없음")
    
    if not verify_password(payload.password, post.password):
        raise HTTPException(status_code=400, detail="비밀번호 불일치")
    
    response = JSONResponse(content={"message": "접근 허용"})
    response.set_cookie(key=f"unlocked_{post_id}", value="true", httponly=True, max_age=600)
    return response

@router.get("/monitoring")
async def view_monitoring_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    menu_boards = await get_menu_boards(db)
    return templates.TemplateResponse("monitoring.html", {
        "request": request, 
        "boards": menu_boards 
    })

@router.get("/menu/{menu_code}")
async def view_menu_dashboard(
    request: Request, 
    menu_code: str, 
    q: Optional[str] = None, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Menu).where(Menu.code == menu_code))
    menu = result.scalar_one_or_none()
    
    if not menu:
        raise HTTPException(status_code=404, detail="존재하지 않는 메뉴입니다.")

    if q:
        stmt = (
            select(Post, Board)
            .join(Board, Post.board_id == Board.id)
            .where(
                Board.menu_id == menu.id,
                Board.is_visible == True, 
                or_(Board.url == None, Board.url == ""), 
                or_(Post.title.ilike(f"%{q}%"), Post.content.ilike(f"%{q}%"))
            )
            .order_by(Post.created_at.desc())
        )
        
        result = await db.execute(stmt)
        rows = result.all()

        grouped_data = {} 
        temp_groups = defaultdict(list)
        board_info_map = {} 
        total_count = 0

        for post, board in rows:
            post_data = {
                "id": post.id,
                "title": post.title,
                "content": get_preview_text(post.content, post.is_secret), 
                "writer": post.writer,
                "created_at": post.created_at,
                "has_file": "/uploads/" in (post.content or ""),
                "is_secret": post.is_secret,
                "url": f"/board/view/{post.id}"
            }
            temp_groups[board.name].append(post_data)
            board_info_map[board.name] = board.code
            total_count += 1

        for b_name, p_list in temp_groups.items():
            grouped_data[b_name] = {
                "code": board_info_map[b_name],
                "posts": p_list[:5],
                "total": len(p_list)
            }

        return templates.TemplateResponse("menu_dashboard.html", {
            "request": request,
            "menu": menu,
            "boards": [],
            "search_mode": True, 
            "keyword": q,
            "grouped_results": grouped_data,
            "board_counts": {k: v['total'] for k, v in grouped_data.items()},
            "total_count": total_count
        })

    boards_result = await db.execute(
        select(Board)
        .where(
            Board.menu_id == menu.id,
            Board.is_visible == True,
            or_(Board.url == None, Board.url == "")
        )
        .order_by(Board.order_no, Board.id)
    )
    boards = boards_result.scalars().all()

    board_data = []
    for b in boards:
        posts_result = await db.execute(
            select(Post)
            .where(Post.board_id == b.id)
            .order_by(Post.created_at.desc()) 
            .limit(5)
        )
        recent_posts = posts_result.scalars().all()
        board_data.append({
            "info": b,
            "posts": recent_posts
        })

    return templates.TemplateResponse("menu_dashboard.html", {
        "request": request,
        "menu": menu,
        "boards": board_data,
        "search_mode": False 
    })


@router.get("/api/search/paging")
async def search_board_paging(
    request: Request,
    board_code: str,
    q: str,
    page: int = 1,
    db: AsyncSession = Depends(get_db)
):
    limit = 5
    offset = (page - 1) * limit
    processed_posts = []
    total_count = 0  

    if board_code == "journal":
        search_filter = or_(
            Journal.title.ilike(f"%{q}%"),
            Journal.content_day.ilike(f"%{q}%"),
            Journal.content_night.ilike(f"%{q}%"),
            Journal.content_handover.ilike(f"%{q}%"),
            Journal.content_etc.ilike(f"%{q}%")
        )
        
        count_stmt = select(func.count()).select_from(Journal).where(search_filter)
        total_count = (await db.execute(count_stmt)).scalar() or 0

        stmt = (
            select(Journal)
            .where(search_filter)
            .order_by(Journal.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await db.execute(stmt)
        journals = res.scalars().all()

        for j in journals:
            combined_content = f"{j.content_day or ''} {j.content_night or ''} {j.content_handover or ''} {j.content_etc or ''}"
            processed_posts.append({
                "id": j.id,
                "title": j.title,
                "content": get_preview_text(combined_content, False), 
                "writer": j.writer_day,
                "created_at": j.created_at,
                "has_file": False,
                "is_secret": False,
                "url": f"/journal/view/{j.id}"
            })

    else:
        res_b = await db.execute(select(Board).where(Board.code == board_code))
        board = res_b.scalar_one_or_none()
        if not board: return Response(content="Board not found", status_code=404)

        search_filter = or_(Post.title.ilike(f"%{q}%"), Post.content.ilike(f"%{q}%"))
        
        count_stmt = select(func.count()).select_from(Post).where(Post.board_id == board.id, search_filter)
        total_count = (await db.execute(count_stmt)).scalar() or 0

        query = (
            select(Post)
            .where(Post.board_id == board.id, search_filter)
            .order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res_p = await db.execute(query)
        posts = res_p.scalars().all()

        for p in posts:
            processed_posts.append({
                "id": p.id,
                "title": p.title,
                "content": get_preview_text(p.content, p.is_secret), 
                "writer": p.writer,
                "created_at": p.created_at,
                "has_file": "/uploads/" in (p.content or ""),
                "is_secret": p.is_secret,
                "url": f"/board/view/{p.id}"
            })

    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1

    return templates.TemplateResponse("snippet_post_list.html", {
        "request": request,
        "posts": processed_posts,
        "keyword": q,
        "board_code": board_code,
        "current_page": page,
        "total_pages": total_pages,
        "total_count": total_count
    })


@router.get("/board/{board_code}")
async def view_board_list(
    request: Request, board_code: str, page: int = 1, q: Optional[str] = None, category: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Board).where(Board.code == board_code))
    board = result.scalar_one_or_none()
    if not board: raise HTTPException(status_code=404, detail="게시판 없음")

    limit = 25
    offset = (page - 1) * limit

    notice_res = await db.execute(select(Post).where(Post.board_id == board.id, Post.is_notice == True).order_by(Post.created_at.desc()))
    notices = notice_res.scalars().all()

    base_query = select(Post).where(Post.board_id == board.id, Post.is_notice == False)
    if category and category != "전체": base_query = base_query.where(Post.category == category)
    if q: base_query = base_query.where(or_(Post.title.ilike(f"%{q}%"), Post.content.ilike(f"%{q}%"))) 

    count_res = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total_count = count_res.scalar() or 0

    post_res = await db.execute(base_query.order_by(Post.created_at.desc()).offset(offset).limit(limit))
    posts = post_res.scalars().all()

    total_pages = math.ceil(total_count / limit)
    if total_pages == 0: total_pages = 1
    
    start_page = page - 5
    end_page = page + 5
    if start_page < 1: end_page += (1 - start_page); start_page = 1
    if end_page > total_pages: start_page -= (end_page - total_pages); end_page = total_pages
    if start_page < 1: start_page = 1

    return templates.TemplateResponse("board_list.html", {
        "request": request, "board": board, "board_name": board.name, "board_code": board.code,
        "notices": notices, "posts": posts, "boards": await get_menu_boards(db),
        "current_page": page, "total_pages": total_pages, "total_count": total_count,
        "start_page": start_page, "end_page": end_page, "limit": limit, "keyword": q, "current_category": category 
    })


@router.get("/board/view/{post_id}")
async def view_post_detail(request: Request, post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post: raise HTTPException(status_code=404)
    board_res = await db.execute(select(Board).where(Board.id == post.board_id))
    board = board_res.scalar_one_or_none()
    menu_boards = await get_menu_boards(db)

    cookie_name = f"unlocked_{post_id}"
    if post.is_secret and request.cookies.get(cookie_name) != "true":
        return templates.TemplateResponse("board_secret.html", {"request": request, "post": post, "board": board, "boards": menu_boards})

    post.view_count += 1
    await db.commit()
    return templates.TemplateResponse("board_view.html", {"request": request, "post": post, "board": board, "boards": menu_boards})


@router.get("/board/write/{board_code}")
async def view_board_write(request: Request, board_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Board).where(Board.code == board_code))
    board = result.scalar_one_or_none()
    if not board: raise HTTPException(status_code=404)
    return templates.TemplateResponse("board_write.html", {"request": request, "board": board, "mode": "create", "boards": await get_menu_boards(db)})

@router.get("/board/edit/{post_id}")
async def view_board_edit(request: Request, post_id: int, db: AsyncSession = Depends(get_db)):
    post_res = await db.execute(select(Post).where(Post.id == post_id))
    post = post_res.scalar_one_or_none()
    if not post: raise HTTPException(status_code=404)
    board_res = await db.execute(select(Board).where(Board.id == post.board_id))
    board = board_res.scalar_one_or_none()
    return templates.TemplateResponse("board_write.html", {"request": request, "board": board, "post": post, "mode": "edit", "boards": await get_menu_boards(db)})

@router.get("/admin/board")
async def view_admin_board(request: Request, db: AsyncSession = Depends(get_db)):
    return templates.TemplateResponse("layout_board.html", {"request": request, "show_admin_modal": True, "boards": await get_menu_boards(db)})


@router.get("/search")
async def view_search_result(request: Request, q: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    menu_boards = await get_menu_boards(db)

    if not q:
        return templates.TemplateResponse("search_result.html", {
            "request": request, "boards": menu_boards, "results": {}, "total_count": 0, "keyword": ""
        })

    stmt = (
        select(Post, Board)
        .join(Board, Post.board_id == Board.id)
        .where(
            Board.is_visible == True, 
            or_(Board.url == None, Board.url == ""), 
            or_(Post.title.ilike(f"%{q}%"), Post.content.ilike(f"%{q}%"))
        )
        .order_by(Post.created_at.desc())
    )
    result = await db.execute(stmt)
    post_rows = result.all()

    search_filter = or_(
        Journal.title.ilike(f"%{q}%"),
        Journal.content_day.ilike(f"%{q}%"),
        Journal.content_night.ilike(f"%{q}%"),
        Journal.content_handover.ilike(f"%{q}%"),
        Journal.content_etc.ilike(f"%{q}%")
    )
    
    stmt_j = (
        select(Journal)
        .where(search_filter)
        .order_by(Journal.created_at.desc())
    )
    result_j = await db.execute(stmt_j)
    journal_rows = result_j.scalars().all()

    temp_groups = defaultdict(list)
    board_info_map = {} 
    total_count = 0

    for post, board in post_rows:
        post_data = {
            "id": post.id,
            "title": post.title,
            "content": get_preview_text(post.content, post.is_secret), 
            "writer": post.writer,
            "created_at": post.created_at,
            "has_file": "/uploads/" in (post.content or ""), 
            "is_secret": post.is_secret,
            "url": f"/board/view/{post.id}"
        }
        temp_groups[board.name].append(post_data)
        board_info_map[board.name] = board.code
        total_count += 1

    if journal_rows:
        j_group_name = "업무일지"
        board_info_map[j_group_name] = "journal"
        for j in journal_rows:
            combined_content = f"{j.content_day or ''} {j.content_night or ''} {j.content_handover or ''} {j.content_etc or ''}"
            
            j_data = {
                "id": j.id,
                "title": j.title, 
                "content": get_preview_text(combined_content, False), 
                "writer": j.writer_day,
                "created_at": j.created_at,
                "has_file": False,
                "is_secret": False,
                "url": f"/journal/view/{j.id}"
            }
            temp_groups[j_group_name].append(j_data)
            total_count += 1

    grouped_data = {}
    for b_name, p_list in temp_groups.items():
        grouped_data[b_name] = {
            "code": board_info_map[b_name],
            "posts": p_list[:5],
            "total": len(p_list)
        }

    return templates.TemplateResponse("search_result.html", {
        "request": request,
        "boards": menu_boards,      
        "grouped_results": grouped_data, 
        "board_counts": {k: v['total'] for k, v in grouped_data.items()},       
        "total_count": total_count,
        "keyword": q
    })


@router.get("/tma")
async def view_tma_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
   menu_boards = await get_menu_boards(db)
   return templates.TemplateResponse("tma_list.html", {"request": request, "boards": menu_boards})

@router.get("/monitoring/sys")
async def view_sys_monitoring(request: Request, db: AsyncSession = Depends(get_db)):
    menu_boards = await get_menu_boards(db)
    return templates.TemplateResponse("monitoring_sys.html", {"request": request, "boards": menu_boards})

@router.get("/api/config/sys")
async def get_sys_config():
    config_path = BASE_DIR / "monitoring_sys_config.json"
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/monitoring/tm")
async def view_tm_monitoring(request: Request, db: AsyncSession = Depends(get_db)):
    menu_boards = await get_menu_boards(db)
    return templates.TemplateResponse("monitoring_tm.html", {"request": request, "boards": menu_boards})

@router.get("/api/config/tm")
async def get_tm_config():
    config_path = BASE_DIR / "monitoring_tm_config.json"
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/monitoring/terminal")
async def view_monitoring_terminal(request: Request, db: AsyncSession = Depends(get_db)):
    menu_boards = await get_menu_boards(db)
    return templates.TemplateResponse("monitoring_terminal.html", {
        "request": request, 
        "boards": menu_boards
    })

@router.get("/legacy-search")
async def view_legacy_search(request: Request, db: AsyncSession = Depends(get_db)):
    menu_boards = await get_menu_boards(db)
    return templates.TemplateResponse("legacy_search.html", {
        "request": request, 
        "boards": menu_boards
    })

@router.get("/api/log")
async def get_monitoring_log_file(path: str):
    import os

    if not path.startswith("scripts/"):
        return Response(content="[ 99/12/31 23:59:59 ]\n[FAIL]\n잘못된 접근입니다.", media_type="text/plain")

    full_path = f"/app/{path}"

    if not os.path.exists(full_path):
        dir_path = os.path.dirname(full_path)
        if os.path.exists(dir_path):
            files = os.listdir(dir_path)
            error_msg = f"[ 99/12/31 23:59:59 ]\n[FAIL]\n백엔드 경로에 파일이 없습니다.\n- 찾는 경로: {full_path}\n- 현재 폴더 내용물: {files}\n(도커 볼륨은 연결되었으나, 호스트에 파일이 생성되지 않음)"
        else:
            error_msg = f"[ 99/12/31 23:59:59 ]\n[FAIL]\n백엔드에 폴더 자체가 존재하지 않습니다.\n- 찾는 경로: {full_path}\n(docker-compose.yml 볼륨 마운트가 실패했거나 누락됨)"
        
        return Response(content=error_msg, media_type="text/plain")
        
    try:
        with open(full_path, "rb") as f:
            raw_data = f.read()
            try:
                content = raw_data.decode("utf-8")
            except UnicodeDecodeError:
                content = raw_data.decode("euc-kr", errors="replace")
        return Response(content=content, media_type="text/plain")
    except Exception as e:
        return Response(content=f"[ 99/12/31 23:59:59 ]\n[FAIL]\n파일 읽기 권한 오류: {str(e)}", media_type="text/plain")