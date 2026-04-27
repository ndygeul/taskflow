from sqlalchemy import Column, Integer, String, Boolean
from app.core.database import Base

class Alarm(Base):
    __tablename__ = "alarms"
    id = Column(Integer, primary_key=True, index=True)
    time = Column(String(5), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    repeat_type = Column(String(10), default="DAILY")
    repeat_days = Column(String(50), nullable=True)