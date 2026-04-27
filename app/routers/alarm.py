from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.models.alarm import Alarm

router = APIRouter(prefix="/api/alarms", tags=["alarms"])

class AlarmCreate(BaseModel):
    time: str
    name: str
    repeat_type: str = "DAILY"
    repeat_days: Optional[str] = ""

class AlarmUpdate(BaseModel):
    is_active: bool

@router.get("/")
async def get_alarms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alarm).order_by(Alarm.time))
    return result.scalars().all()

@router.post("/")
async def create_alarm(req: AlarmCreate, db: AsyncSession = Depends(get_db)):
    new_alarm = Alarm(
        time=req.time, 
        name=req.name, 
        is_active=True,
        repeat_type=req.repeat_type,
        repeat_days=req.repeat_days
    )
    db.add(new_alarm)
    await db.commit()
    await db.refresh(new_alarm)
    return new_alarm

@router.put("/{alarm_id}/toggle")
async def toggle_alarm(alarm_id: int, req: AlarmUpdate, db: AsyncSession = Depends(get_db)):
    alarm = await db.get(Alarm, alarm_id)
    if not alarm: raise HTTPException(status_code=404)
    alarm.is_active = req.is_active
    await db.commit()
    return {"message": "updated"}

@router.delete("/{alarm_id}")
async def delete_alarm(alarm_id: int, db: AsyncSession = Depends(get_db)):
    alarm = await db.get(Alarm, alarm_id)
    if not alarm: raise HTTPException(status_code=404)
    await db.delete(alarm)
    await db.commit()
    return {"message": "deleted"}