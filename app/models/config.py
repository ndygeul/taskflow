from sqlalchemy import Column, String
from app.core.database import Base

class SystemConfig(Base):
    __tablename__ = "system_config"
    key = Column(String(255), primary_key=True, index=True)
    value = Column(String(255), nullable=False)