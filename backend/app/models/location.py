from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
from .user_location_permission import user_location_permissions


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    manager_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    products = relationship("Product", back_populates="location", lazy="dynamic")
    work_processes = relationship("WorkProcess", back_populates="location", lazy="dynamic")
    permitted_users = relationship(
        "User", secondary=user_location_permissions, back_populates="permitted_locations"
    )
    product_stocks = relationship("ProductStock", back_populates="location", cascade="all, delete-orphan")
    purchase_orders = relationship("PurchaseOrder", back_populates="destination_location")
    outgoing_transfers = relationship("WarehouseTransfer", foreign_keys="WarehouseTransfer.source_location_id", back_populates="source_location")
    incoming_transfers = relationship("WarehouseTransfer", foreign_keys="WarehouseTransfer.destination_location_id", back_populates="destination_location")
