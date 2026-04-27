from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_, and_
from app.core.database import get_db
from app.models.journal import Journal
from app.models.board import Board
from app.models.schedule import WorkSchedule
from app.models.event import Event
from app.core.security import get_password_hash, verify_password
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import math
from datetime import datetime, timedelta, time
import secrets
import sys
import re
import os
from urllib.parse import unquote

UPLOAD_DIR = Path("/app/uploads")
BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory="templates")

router = APIRouter(prefix="/journal", tags=["journal"])

class JournalCreate(BaseModel):
    work_date: str
    writer_day: str
    writer_night: Optional[str] = ""
    title: str
    password: str
    content_day: Optional[str] = ""
    content_handover: Optional[str] = ""
    content_night: Optional[str] = ""
    content_etc: Optional[str] = ""
    
    is_notice: int = 0  
    is_secret: int = 0

class JournalDelete(BaseModel):
    password: str

class JournalVerify(BaseModel):
    password: str

async def get_menu_boards(db: AsyncSession):
    result = await db.execute(select(Board).order_by(Board.id))
    return result.scalars().all()

@router.post("/api/{journal_id}/verify")
async def verify_journal_password(journal_id: int, req: JournalVerify, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()
    if not journal:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다.")
    
    clean_pwd = req.password.strip()
    if not verify_password(clean_pwd, journal.password):
        return {"valid": False}
    return {"valid": True}

@router.get("/api/{journal_id}/check-lock")
async def check_journal_lock(journal_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()
    if not journal: return {"locked": False}

    client_token = request.headers.get("X-Lock-Token")
    
    if journal.editor_ip and journal.edit_started_at:
        time_diff = datetime.now() - journal.edit_started_at
        if time_diff > timedelta(minutes=30):
            return {"locked": False}
        
        stored_info = journal.editor_ip.split('|')
        stored_ip = stored_info[0]
        stored_token = stored_info[1] if len(stored_info) > 1 else None

        def mask_ip(ip_addr):
            if not ip_addr: return "Unknown"
            parts = ip_addr.split('.')
            if len(parts) == 4: return f"☆.☆.☆.{parts[-1]}"
            return ip_addr

        if stored_token and stored_token != client_token:
            return {"locked": True, "editor_ip": mask_ip(stored_ip)}
        
        if not stored_token:
             client_ip = request.headers.get("x-forwarded-for") or request.client.host
             if journal.editor_ip != client_ip:
                 return {"locked": True, "editor_ip": mask_ip(journal.editor_ip)}

    return {"locked": False}

@router.post("/api/{journal_id}/unlock")
async def unlock_journal(journal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()
    if journal:
        journal.editor_ip = None
        journal.edit_started_at = None
        await db.commit()
    return {"message": "unlocked"}

@router.get("/")
async def list_journals(request: Request, page: int = 1, q: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    limit = 20
    offset = (page - 1) * limit
    query = select(Journal)
    count_query = select(func.count()).select_from(Journal)

    if q:
        search_filter = or_(
            Journal.title.contains(q), Journal.content_day.contains(q),
            Journal.content_handover.contains(q), Journal.content_night.contains(q),
            Journal.content_etc.contains(q)
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_res = await db.execute(count_query)
    total_count = total_res.scalar() or 0
    
    result = await db.execute(
        query.order_by(desc(Journal.is_notice), desc(Journal.work_date), desc(Journal.id))
             .offset(offset).limit(limit)
    )
    journals = result.scalars().all()
    
    total_pages = math.ceil(total_count / limit)
    start_page = page - 5
    end_page = page + 5
    if start_page < 1: end_page += (1 - start_page); start_page = 1
    if end_page > total_pages: start_page -= (end_page - total_pages); end_page = total_pages
    if start_page < 1: start_page = 1
    
    return templates.TemplateResponse("journal_list.html", {
        "request": request, "journals": journals, "boards": await get_menu_boards(db),
        "current_page": page, "total_pages": total_pages, "total_count": total_count,
        "start_page": start_page, "end_page": end_page, "keyword": q
    })

@router.get("/write")
async def write_journal_page(request: Request, db: AsyncSession = Depends(get_db)):
    today = datetime.now().date()
    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)
    stmt_work = select(WorkSchedule).where(
        WorkSchedule.work_date == today,
        or_(
            WorkSchedule.shift_type.like('%○%'),
            WorkSchedule.shift_type.like('%●%'),
            WorkSchedule.shift_type.like('%⚪%'),
            WorkSchedule.shift_type.like('%⚫%')
        )
    )
    res_work = await db.execute(stmt_work)
    rows = res_work.scalars().all()
    stmt_leave = select(Event).where(
        or_(
            Event.color == '#6c757d',
            Event.title.like('%연차%'),
            Event.title.like('%휴가%'),
            Event.title.like('%공가%')
        ),
        or_(
            and_(Event.end == None, Event.start >= today_start, Event.start <= today_end),
            and_(Event.end != None, Event.start <= today_end, Event.end >= today_start)
        )
    )
    res_leave = await db.execute(stmt_leave)
    leave_titles = [e.title for e in res_leave.scalars().all() if e.title]

    def is_on_leave(name): 
        if not name: return False
        return any(name.strip() in title for title in leave_titles)

    today_day_workers = ", ".join([r.worker_name for r in rows if ('○' in r.shift_type or '⚪' in r.shift_type) and not is_on_leave(r.worker_name)])
    today_night_workers = ", ".join([r.worker_name for r in rows if ('●' in r.shift_type or '⚫' in r.shift_type) and not is_on_leave(r.worker_name)])

    return templates.TemplateResponse("journal_write.html", {
        "request": request, "mode": "create", "boards": await get_menu_boards(db),
        "today_day_workers": today_day_workers, "today_night_workers": today_night_workers
    })

@router.post("/write")
async def create_journal(req: JournalCreate, request: Request, db: AsyncSession = Depends(get_db)):
    clean_pwd = req.password.strip()
    hashed_pw = get_password_hash(clean_pwd)

    client_ip = request.headers.get("x-forwarded-for") or request.client.host
    new_journal = Journal(
        work_date=req.work_date, writer_day=req.writer_day, writer_night=req.writer_night,
        title=req.title, password=hashed_pw,
        content_day=req.content_day, content_handover=req.content_handover,
        content_night=req.content_night, content_etc=req.content_etc,
        ip_address=client_ip,
        is_notice=req.is_notice, 
        is_secret=req.is_secret  
    )
    db.add(new_journal)
    await db.commit()
    return {"message": "업무일지가 저장되었습니다."}

@router.get("/view/{journal_id}")
async def view_journal(request: Request, journal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()
    
    if not journal:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다.")
    
    prev_res = await db.execute(select(Journal.id, Journal.title).where(Journal.id < journal_id).order_by(Journal.id.desc()).limit(1))
    prev_journal = prev_res.first()
    
    next_res = await db.execute(select(Journal.id, Journal.title).where(Journal.id > journal_id).order_by(Journal.id.asc()).limit(1))
    next_journal = next_res.first()

    return templates.TemplateResponse("journal_view.html", {
        "request": request, "journal": journal, "prev_journal": prev_journal, 
        "next_journal": next_journal, "boards": await get_menu_boards(db)
    })

@router.get("/edit/{journal_id}")
async def edit_journal_page(request: Request, journal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()
    if not journal: raise HTTPException(status_code=404)
    
    client_ip = request.headers.get("x-forwarded-for") or request.client.host
    lock_token = secrets.token_hex(4) 
    journal.editor_ip = f"{client_ip}|{lock_token}"
    journal.edit_started_at = datetime.now()
    await db.commit()
    
    return templates.TemplateResponse("journal_write.html", {
        "request": request, "journal": journal, "mode": "edit", 
        "lock_token": lock_token, 
        "boards": await get_menu_boards(db)
    })

@router.put("/{journal_id}")
async def update_journal(journal_id: int, req: JournalCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()
    if not journal: raise HTTPException(status_code=404)
    
    clean_pwd = req.password.strip()
    if not verify_password(clean_pwd, journal.password):
        raise HTTPException(status_code=403, detail="비밀번호가 일치하지 않습니다.")
    
    journal.work_date = req.work_date
    journal.writer_day = req.writer_day
    journal.writer_night = req.writer_night
    journal.title = req.title
    journal.content_day = req.content_day
    journal.content_handover = req.content_handover
    journal.content_night = req.content_night
    journal.content_etc = req.content_etc
    journal.is_notice = req.is_notice
    journal.is_secret = req.is_secret 
    journal.editor_ip = None
    journal.edit_started_at = None
    
    await db.commit()
    return {"message": "수정되었습니다."}

@router.delete("/{journal_id}")
async def delete_journal(journal_id: int, req: JournalDelete, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Journal).where(Journal.id == journal_id))
    journal = result.scalar_one_or_none()

    if not journal:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다.")

    clean_pwd = req.password.strip()
    if not verify_password(clean_pwd, journal.password):
        raise HTTPException(status_code=403, detail="비밀번호가 일치하지 않습니다.")

    target_contents = [journal.content_day, journal.content_handover, journal.content_night, journal.content_etc]
    for content in target_contents:
        if content:
            files = re.findall(r'/uploads/([^"\']+)', content)
            for filename in files:
                try:
                    decoded_filename = unquote(filename).split("?")[0].split("#")[0]
                    file_path = UPLOAD_DIR / decoded_filename
                    if file_path.exists() and file_path.is_file():
                        os.remove(file_path)
                except Exception: pass

    await db.delete(journal)
    await db.commit()
    return {"message": "삭제되었습니다."}