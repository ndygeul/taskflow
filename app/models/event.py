from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from app.core.database import Base
from datetime import datetime

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String(255), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    start = Column(DateTime, nullable=False)
    end = Column(DateTime, nullable=True)
    all_day = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    password = Column(String(255), nullable=False)
    color = Column(String(255), default="#3788d8")
    created_at = Column(DateTime, default=datetime.now)
