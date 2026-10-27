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
    "Adjustment In",
    "Adjustment Out",
    "Opening Balance",
]

#this list holds the movement types that increase stock
INBOUND_TYPES = {
    "Stock In",
    "Purchase Receipt",
    "Warehouse Transfer In",
    "Adjustment In",
    "Opening Balance",
}

#this list holds the movement types that decrease stock
OUTBOUND_TYPES = {
    "Stock Out",
    "Warehouse Transfer Out",
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
    #these columns keep the locations involved
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    #these columns keep the business context. project_id / purchase_order_id belong to
    #removed features and stay so old rows keep their data
    project_id = Column(Integer, nullable=True)
    purchase_order_id = Column(Integer, nullable=True)
    transfer_id = Column(Integer, ForeignKey("warehouse_transfers.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True, index=True)
    #these columns keep who approved and received
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="stock_movements")
    user = relationship("User", foreign_keys=[user_id], back_populates="stock_movements")
    source_location = relationship("Location", foreign_keys=[source_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    received_by = relationship("User", foreign_keys=[received_by_id])
