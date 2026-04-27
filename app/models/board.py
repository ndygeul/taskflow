from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, func, Date
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class Menu(Base):
    __tablename__ = "menus"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(255), unique=True, nullable=False)
    order_no = Column(Integer, default=0)
    boards = relationship("Board", back_populates="menu")

class Board(Base):
    __tablename__ = "boards"
    id = Column(Integer, primary_key=True, index=True)
    menu_id = Column(Integer, ForeignKey("menus.id"), nullable=True)
    name = Column(String(255), nullable=False)
    code = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    admin_password = Column(String(255), nullable=True)
    order_no = Column(Integer, default=0) 
    is_visible = Column(Boolean, default=True)
    category_list = Column(String(255), nullable=True) 
    type = Column(String(255), default="board")
    url = Column(String(255), nullable=True)
    icon = Column(String(255), nullable=True)
    is_external = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    menu = relationship("Menu", back_populates="boards")
    posts = relationship("Post", back_populates="board", cascade="all, delete")
    is_sidebar = Column(Boolean, default=False)

class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    writer = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    category = Column(String(255), nullable=True)
    view_count = Column(Integer, default=0)
    is_secret = Column(Boolean, default=False)
    is_notice = Column(Boolean, default=False)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    board = relationship("Board", back_populates="posts")

class EquipmentHistory(Base):
    __tablename__ = "equipment_history"
    id = Column(Integer, primary_key=True, index=True)
    replace_date = Column(Date, nullable=False, index=True)
    category = Column(String(50), nullable=False)
    vendor = Column(String(50), nullable=False)
    equipment_name = Column(String(100), nullable=False, index=True)
    part_name = Column(String(100), nullable=False)
    spec = Column(String(100), nullable=True)
    quantity = Column(Integer, default=1)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class FaultHistory(Base):
    __tablename__ = "fault_history"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fault_date = Column(Date, nullable=False)
    system = Column(String(100), nullable=False)
    field_name = Column(String(100), nullable=False)
    equipment_name = Column(String(100), nullable=False)
    checker = Column(String(100), nullable=True)
    is_emergency = Column(Boolean, default=False)
    description = Column(Text, nullable=True)