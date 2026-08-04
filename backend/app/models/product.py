from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(Text, nullable=True)
    quantity = Column(Float, default=0, nullable=False)
    unit = Column(String(50), default="pcs", nullable=False)
    min_stock_level = Column(Float, default=0, nullable=False)
    unit_price = Column(Float, default=0, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    image_url = Column(String(500), nullable=True)
    status = Column(String(30), default="active", nullable=False)
    notes = Column(Text, nullable=True)
    # Soft-delete / archive fields. "Deleting" a product through the API sets
    # status="archived" and stamps these rather than removing the row --
    # stock movement history must survive a product being retired, which a
    # hard delete (with its FK cascade) would otherwise destroy.
    archived_at = Column(DateTime(timezone=True), nullable=True)
    archived_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="products")
    location = relationship("Location", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    archived_by = relationship("User", foreign_keys=[archived_by_id])
    stock_movements = relationship("StockMovement", back_populates="product", lazy="dynamic")
    work_processes = relationship("WorkProcess", back_populates="product", lazy="dynamic")

    @property
    def is_low_stock(self) -> bool:
        return self.quantity <= self.min_stock_level and self.min_stock_level > 0
