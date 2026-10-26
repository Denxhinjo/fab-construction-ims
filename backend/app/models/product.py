from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Product(Base):
    """A material. Its stock lives per warehouse in ProductStock; `quantity`
    is the cached total across all warehouses, kept in sync by
    inventory_service.record_movement."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(100), unique=True, nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(Text, nullable=True)
    quantity = Column(Float, default=0, nullable=False)
    unit = Column(String(50), default="copë", nullable=False)
    # Default minimum for warehouses that don't set their own (ProductStock.min_quantity).
    min_stock_level = Column(Float, default=0, nullable=False)
    unit_price = Column(Float, nullable=True)
    latest_cost = Column(Float, nullable=True)
    avg_cost = Column(Float, nullable=True)
    # Legacy single "home" warehouse from before per-warehouse stock. No longer read.
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    price_currency = Column(String(3), default="ALL", nullable=False)
    status = Column(String(30), default="active", nullable=False)
    notes = Column(Text, nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    archived_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    stock_movements = relationship("StockMovement", back_populates="product", lazy="dynamic")
    location_stocks = relationship("ProductStock", back_populates="product", cascade="all, delete-orphan")
    transfer_items = relationship("WarehouseTransferItem", back_populates="product")

    @property
    def cost(self) -> float:
        """Cost used to value stock: weighted average from accepted invoices,
        falling back to the last invoice price, then the manual price."""
        return self.avg_cost or self.latest_cost or self.unit_price or 0.0
