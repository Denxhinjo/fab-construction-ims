from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String(30), nullable=False)  # Stock In / Stock Out / Adjustment
    quantity = Column(Float, nullable=False)
    previous_quantity = Column(Float, nullable=True)
    new_quantity = Column(Float, nullable=True)
    reason = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    movement_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    reference_number = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="stock_movements")
    user = relationship("User", back_populates="stock_movements")
