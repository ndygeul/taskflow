from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.event import Event
from app.schemas import EventCreate, EventResponse, EventAuth, RecurringEventCreate
from app.core.security import get_password_hash, verify_password
from datetime import datetime, timedelta, time, date
import calendar
import uuid
import traceback

try:
    from korean_lunar_calendar import KoreanLunarCalendar
except ImportError:
    KoreanLunarCalendar = None

router = APIRouter(prefix="/api/events", tags=["calendar"])

def parse_datetime(dt_val):
    if isinstance(dt_val, datetime): return dt_val
    if isinstance(dt_val, str):
        try: return datetime.strptime(dt_val, "%Y-%m-%d %H:%M")
        except ValueError:
            try: return datetime.fromisoformat(dt_val.replace('Z', ''))
            except ValueError: return datetime.strptime(dt_val[:10], "%Y-%m-%d")
    raise ValueError(f"지원하지 않는 날짜 형식입니다: {type(dt_val)}")

@router.get("/", response_model=list[EventResponse])
async def get_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event))
    return result.scalars().all()

@router.post("/", response_model=EventResponse)
async def create_event(event: EventCreate, db: AsyncSession = Depends(get_db)):
    try:
        start_dt = parse_datetime(event.start)
        end_dt = parse_datetime(event.end) if event.end else start_dt + timedelta(hours=1)

        new_event = Event(
            title=event.title,
            start=start_dt,
            end=end_dt,
            all_day=event.all_day,
            description=event.description,
            color=event.color,
            password=get_password_hash(event.password)
        )
        db.add(new_event)
        await db.commit()
        await db.refresh(new_event)
        return new_event
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일정 등록 실패: {str(e)}")

@router.post("/recurring", response_model=dict)
async def create_recurring_events(req: RecurringEventCreate, db: AsyncSession = Depends(get_db)):
    try:
        current_date = datetime.strptime(req.start_date, "%Y-%m-%d")
        end_date_obj = datetime.strptime(req.end_date, "%Y-%m-%d")
        if req.all_day: s_hour, s_min, e_hour, e_min = 0, 0, 0, 0
        else:
            if not req.start_time or not req.end_time: raise ValueError("시간 입력 필수")
            s_hour, s_min = map(int, req.start_time.split(":"))
            e_hour, e_min = map(int, req.end_time.split(":"))
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))

    group_id_val = str(uuid.uuid4())
    created_count = 0
    lunar_cal = KoreanLunarCalendar() if KoreanLunarCalendar else None

    try:
        while current_date <= end_date_obj:
            is_target_day = False
            if req.recurrence_type == 'weekly':
                if current_date.weekday() == req.recurrence_value: is_target_day = True
            elif req.recurrence_type == 'monthly_date':
                _, last_day = calendar.monthrange(current_date.year, current_date.month)
                target_day = min(req.recurrence_value, last_day)
                if current_date.day == target_day:
                    is_target_day = True
            elif req.recurrence_type == 'monthly_weekday':
                if current_date.weekday() == req.recurrence_value:
                    week_num = (current_date.day - 1) // 7 + 1
                    if week_num == req.recurrence_week: is_target_day = True
                    elif req.recurrence_week == 5:
                        _, last_day = calendar.monthrange(current_date.year, current_date.month)
                        if current_date.day + 7 > last_day: is_target_day = True
            elif req.recurrence_type == 'yearly':
                target_month = req.recurrence_value
                target_day = req.recurrence_week
                is_lunar = getattr(req, 'is_lunar', False)
                if is_lunar and lunar_cal:
                    lunar_cal.setSolarDate(current_date.year, current_date.month, current_date.day)
                    if lunar_cal.lunarMonth == target_month and lunar_cal.lunarDay == target_day: is_target_day = True
                else:
                    if current_date.month == target_month and current_date.day == target_day: is_target_day = True

            if is_target_day:
                start_dt = datetime.combine(current_date.date(), time(s_hour, s_min))
                end_dt = datetime.combine(current_date.date(), time(e_hour, e_min))
                
                new_event = Event(
                    group_id=group_id_val,
                    title=req.title,
                    start=start_dt,
                    end=end_dt,
                    all_day=req.all_day,
                    description=req.description,
                    color=req.color,
                    password=get_password_hash(req.password)
                )
                db.add(new_event)
                created_count += 1
            current_date += timedelta(days=1)

        if created_count > 0: await db.commit()
        return {"message": f"{created_count}개의 반복 일정이 생성되었습니다."}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"생성 실패: {str(e)}")

@router.put("/{event_id}")
async def update_event(event_id: int, event_data: EventCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event: raise HTTPException(status_code=404, detail="일정 없음")

    if not verify_password(event_data.password, event.password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")
    
    try:
        start_dt = parse_datetime(event_data.start)
        end_dt = parse_datetime(event_data.end) if event_data.end else start_dt
        event.title = event_data.title
        event.start = start_dt
        event.end = end_dt
        event.all_day = event_data.all_day
        event.description = event_data.description
        event.color = event_data.color
        await db.commit()
        return event
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.put("/group/{group_id}")
async def update_event_group(group_id: str, event_data: EventCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.group_id == group_id))
    events = result.scalars().all()
    if not events: raise HTTPException(status_code=404, detail="그룹 일정 없음")

    if not verify_password(event_data.password, events[0].password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")

    try:
        start_dt_obj = parse_datetime(event_data.start)
        end_dt_obj = parse_datetime(event_data.end) if event_data.end else start_dt_obj
        new_s_time = start_dt_obj.time()
        new_e_time = end_dt_obj.time()
        for event in events:
            event.title = event_data.title
            event.description = event_data.description
            event.color = event_data.color
            event.all_day = event_data.all_day
            event.start = datetime.combine(event.start.date(), new_s_time)
            if event.end: event.end = datetime.combine(event.end.date(), new_e_time)
            else: event.end = datetime.combine(event.start.date(), new_e_time)
        await db.commit()
        return {"message": "일괄 수정됨"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{event_id}")
async def delete_event(event_id: int, auth: EventAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event: raise HTTPException(status_code=404)

    if not verify_password(auth.password, event.password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")
        
    await db.delete(event)
    await db.commit()
    return {"message": "삭제됨"}

@router.delete("/group/{group_id}")
async def delete_event_group(group_id: str, auth: EventAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.group_id == group_id))
    events = result.scalars().all()
    if not events: raise HTTPException(status_code=404)

    if not verify_password(auth.password, events[0].password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")
        
    for event in events: await db.delete(event)
    await db.commit()
    return {"message": "일괄 삭제됨"}

@router.get("/holidays")
async def get_holidays(start: str = Query(...), end: str = Query(...)):
    if not KoreanLunarCalendar: return []
    try:
        s_date = datetime.fromisoformat(start.replace('Z', '')).date()
        e_date = datetime.fromisoformat(end.replace('Z', '')).date()
        final_list = []
        for year in range(s_date.year, e_date.year + 1):
            raw = []
            rules = [(1,1,"신정",0), (3,1,"삼일절",1), (5,1,"근로자의날",0), (5,5,"어린이날",1), (6,6,"현충일",0), (8,15,"광복절",1), (10,3,"개천절",1), (10,9,"한글날",1), (12,25,"성탄절",1)]
            if year >= 2026: rules.append((7,17,"제헌절",1))
            for m,d,t,r in rules: raw.append({"date":date(year,m,d),"title":t,"rule":r})
            
            lunar = KoreanLunarCalendar()
            lunar.setLunarDate(year,1,1,False); seol = date(lunar.solarYear,lunar.solarMonth,lunar.solarDay)
            raw.extend([{"date":seol-timedelta(days=1),"title":"설날연휴","rule":2},{"date":seol,"title":"설날","rule":2},{"date":seol+timedelta(days=1),"title":"설날연휴","rule":2}])
            
            lunar.setLunarDate(year,4,8,False); buddha = date(lunar.solarYear,lunar.solarMonth,lunar.solarDay)
            raw.append({"date":buddha,"title":"부처님오신날","rule":1})
            
            lunar.setLunarDate(year,8,15,False); chu = date(lunar.solarYear,lunar.solarMonth,lunar.solarDay)
            raw.extend([{"date":chu-timedelta(days=1),"title":"추석연휴","rule":2},{"date":chu,"title":"추석","rule":2},{"date":chu+timedelta(days=1),"title":"추석연휴","rule":2}])

            h_map = {}
            for h in raw: h_map.setdefault(h["date"], []).append(h)
            occupied = set(h_map.keys())
            
            for d in sorted(h_map.keys()):
                h_list = h_map[d]; cand = []
                is_sat, is_sun, overlap = d.weekday()==5, d.weekday()==6, len(h_list)>1
                for h in h_list:
                    if (h["rule"]==1 and (is_sat or is_sun or overlap)) or (h["rule"]==2 and (is_sun or overlap)): cand.append(h["title"])
                if cand:
                    scan = d + timedelta(days=1)
                    while True:
                        if scan.weekday()<5 and scan not in occupied:
                            occupied.add(scan)
                            if s_date<=scan<=e_date: final_list.append({"id":f"sub-{scan}","title":f"대체공휴일({','.join(sorted(list(set(cand))))})","start":scan.isoformat(),"allDay":True,"color":"#dc3545","textColor":"white","editable":False,"display":"block","extendedProps":{"is_holiday":True,"description":"대체공휴일"}})
                            break
                        scan += timedelta(days=1)
            
            for d, h_list in h_map.items():
                if s_date<=d<=e_date:
                    for h in h_list: final_list.append({"id":f"hol-{d}-{h['title']}","title":h["title"],"start":d.isoformat(),"allDay":True,"color":"#dc3545","textColor":"white","editable":False,"display":"block","extendedProps":{"is_holiday":True,"description":"공휴일"}})
        return final_list
    except: return []
