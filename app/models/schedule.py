from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, func 
from app.core.database import Base

class WorkSchedule(Base):
    __tablename__ = "work_schedules"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    work_date = Column(Date, nullable=False, index=True)
    worker_name = Column(String(50), nullable=False, index=True)
    shift_type = Column(String(20), nullable=True)
    is_holiday = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
