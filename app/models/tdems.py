from sqlalchemy import Column, Integer, String, Text, DateTime, func, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Asset(Base):
    __tablename__ = "asset"
    asset_id = Column(Integer, primary_key=True, index=True)
    equip_barcode = Column(String(50), unique=True, index=True, nullable=True)
    rack_location = Column(String(100), index=True)
    mounted_location = Column(String(100))
    hostname = Column(String(255), index=True)
    ip = Column(String(255))
    asset_type = Column(String(100))
    manufacturer = Column(String(100))
    model_name = Column(String(255))
    serial_number = Column(String(255))
    receipt_ym = Column(String(50))
    os = Column(String(255))
    cpu_type = Column(String(255))
    cpu_qty = Column(Integer, default=0)
    cpu_core = Column(Integer, default=0)
    swap_size = Column(String(100))
    ma = Column(String(100))
    status = Column(String(50))
    purpose = Column(String(100))
    purpose_detail = Column(String(255))
    facility_status = Column(String(50))
    own_team = Column(String(100))
    standard_service = Column(String(100))
    unit_service = Column(String(100))
    asset_history = Column(Text, nullable=True)
    created_ip = Column(String(45))
    created_user = Column(String(100))
    updated_ip = Column(String(45))
    updated_user = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    del_yn = Column(String(1), default='N', index=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_reason = Column(String(255), nullable=True)
    memories = relationship("AssetMemory", back_populates="asset", cascade="all, delete-orphan")
    ssds = relationship("AssetSSD", back_populates="asset", cascade="all, delete-orphan")
    hdds = relationship("AssetHDD", back_populates="asset", cascade="all, delete-orphan")

class AssetMemory(Base):
    __tablename__ = "asset_memory"
    id = Column(Integer, primary_key=True)
    equip_barcode = Column(String(50), ForeignKey('asset.equip_barcode', ondelete='CASCADE'), index=True)
    capacity = Column(String(100))
    quantity = Column(Integer)
    asset = relationship("Asset", back_populates="memories")

class AssetSSD(Base):
    __tablename__ = "asset_ssd"
    id = Column(Integer, primary_key=True)
    equip_barcode = Column(String(50), ForeignKey('asset.equip_barcode', ondelete='CASCADE'), index=True)
    capacity = Column(String(100))
    quantity = Column(Integer)
    asset = relationship("Asset", back_populates="ssds")

class AssetHDD(Base):
    __tablename__ = "asset_hdd"
    id = Column(Integer, primary_key=True)
    equip_barcode = Column(String(50), ForeignKey('asset.equip_barcode', ondelete='CASCADE'), index=True)
    capacity = Column(String(100))
    quantity = Column(Integer)
    asset = relationship("Asset", back_populates="hdds")