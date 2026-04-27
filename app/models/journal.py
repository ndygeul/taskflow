from sqlalchemy import Column, Integer, String, Text, DateTime, func
from app.core.database import Base
from datetime import datetime

class Journal(Base):
    __tablename__ = "journals"
    id = Column(Integer, primary_key=True, index=True)
    work_date = Column(String(10), nullable=False, index=True)
    writer_day = Column(String(255), nullable=False)
    writer_night = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    is_notice = Column(Integer, default=0, nullable=False, server_default='0')
    is_secret = Column(Integer, default=0, nullable=False, server_default='0')
    content_day = Column(Text, nullable=True)
    content_handover = Column(Text, nullable=True)
    content_night = Column(Text, nullable=True)
    content_etc = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    editor_ip = Column(String(50), nullable=True)
    edit_started_at = Column(DateTime, nullable=True)
