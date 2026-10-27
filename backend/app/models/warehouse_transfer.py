from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

#this block describes the transfer statuses. a transfer is created already dispatched:
#stock leaves the source warehouse the moment it is sent, and enters the destination
#when it is received. RECEIVED_PARTIAL closes a transfer whose delivery came up short,
#and the missing quantity is recorded on the items and never enters stock.
#DRAFT/PENDING/APPROVED/DISPATCHED/CANCELLED are kept only so rows from the
#previous approval workflow still load
TRANSFER_STATUSES = [
    "IN_TRANSIT", "RECEIVED", "RECEIVED_PARTIAL",
    "DRAFT", "PENDING", "APPROVED", "DISPATCHED", "CANCELLED",
]
OPEN_TRANSFER_STATUSES = ("DISPATCHED", "IN_TRANSIT")


class WarehouseTransfer(Base):
    __tablename__ = "warehouse_transfers"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, nullable=False, index=True)
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    status = Column(String(30), default="IN_TRANSIT", nullable=False)
    notes = Column(Text, nullable=True)
    driver = Column(String(255), nullable=True)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    dispatched_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    source_location = relationship("Location", foreign_keys=[source_location_id], back_populates="outgoing_transfers")
    destination_location = relationship("Location", foreign_keys=[destination_location_id], back_populates="incoming_transfers")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    dispatched_by = relationship("User", foreign_keys=[dispatched_by_id])
    received_by = relationship("User", foreign_keys=[received_by_id])
    items = relationship("WarehouseTransferItem", back_populates="transfer", cascade="all, delete-orphan")


class WarehouseTransferItem(Base):
    __tablename__ = "warehouse_transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("warehouse_transfers.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    received_quantity = Column(Float, default=0.0, nullable=False)
    notes = Column(String(500), nullable=True)

    transfer = relationship("WarehouseTransfer", back_populates="items")
    product = relationship("Product", back_populates="transfer_items")
