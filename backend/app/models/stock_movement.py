from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

MOVEMENT_TYPES = [
    "Stock In",
    "Stock Out",
    "Adjustment",
    "Purchase Receipt",
    "Warehouse Transfer Out",
    "Warehouse Transfer In",
    "Project Issue",
    "Project Return",
    "Supplier Return",
    "Adjustment In",
    "Adjustment Out",
    "Opening Balance",
]

# Types that increase stock
INBOUND_TYPES = {
    "Stock In",
    "Purchase Receipt",
    "Warehouse Transfer In",
    "Project Return",
    "Supplier Return",
    "Adjustment In",
    "Opening Balance",
}

# Types that decrease stock
OUTBOUND_TYPES = {
    "Stock Out",
    "Warehouse Transfer Out",
    "Project Issue",
    "Adjustment Out",
}


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String(50), nullable=False)
    quantity = Column(Float, nullable=False)
    previous_quantity = Column(Float, nullable=True)
    new_quantity = Column(Float, nullable=True)
    reason = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    movement_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    reference_number = Column(String(100), nullable=True)
    # Location context
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    # Business entity context
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    transfer_id = Column(Integer, ForeignKey("warehouse_transfers.id"), nullable=True)
    # Approval/receiving context
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="stock_movements")
    user = relationship("User", foreign_keys=[user_id], back_populates="stock_movements")
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    project = relationship("Project", back_populates="stock_movements")
    purchase_order = relationship("PurchaseOrder", back_populates="stock_movements")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    received_by = relationship("User", foreign_keys=[received_by_id])
