from sqlalchemy import Column, Integer, Float, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class ProductStock(Base):
    __tablename__ = "product_stock"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Float, default=0.0, nullable=False)
    reserved_quantity = Column(Float, default=0.0, nullable=False)
    # Per-warehouse minimum; NULL means "use the product's min_stock_level".
    min_quantity = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("product_id", "location_id", name="uq_product_location"),
    )

    product = relationship("Product", back_populates="location_stocks")
    location = relationship("Location", back_populates="product_stocks")

    @property
    def available_quantity(self) -> float:
        return max(0.0, self.quantity - self.reserved_quantity)

    @property
    def effective_min(self) -> float:
        if self.min_quantity is not None:
            return self.min_quantity
        return self.product.min_stock_level if self.product else 0.0

    @property
    def is_below_min(self) -> bool:
        return self.effective_min > 0 and self.quantity < self.effective_min
