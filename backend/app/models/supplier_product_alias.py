from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class SupplierProductAlias(Base):
    """this class remembers that a supplier's code or description means one of our
    materials. it is written every time an invoice is accepted, so the next
    invoice from the same supplier matches its rows without any guessing"""
    __tablename__ = "supplier_product_aliases"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    #this line keeps the normalised (see invoice_matching.normalize) supplier code or description
    kind = Column(String(10), nullable=False)  #this line says if the key is a code or text
    key = Column(String(500), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    unit = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("supplier_id", "kind", "key", name="uq_supplier_alias"),
    )

    supplier = relationship("Supplier", back_populates="aliases")
    product = relationship("Product")
