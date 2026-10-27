from sqlalchemy import (
    Column, Integer, String, Text, Float, ForeignKey, DateTime, Date, LargeBinary, Boolean,
)
from sqlalchemy.orm import relationship, deferred
from sqlalchemy.sql import func
from ..database import Base

#these are the invoice statuses:
#review   -- read (fully or partly), waiting for a person to check and confirm
#failed   -- nothing usable could be read, it can still be filled in by hand
#accepted -- confirmed, its stock lines have been booked into the warehouse
#rejected -- discarded by a person, nothing was booked
INVOICE_STATUSES = ["review", "failed", "accepted", "rejected"]
EDITABLE_INVOICE_STATUSES = ("review", "failed")

#these are the invoice line kinds:
#stock -- a material that enters the warehouse
#extra -- a cost on the invoice that is not stock (transport, services)
#skip  -- ignored entirely
LINE_KINDS = ["stock", "extra", "skip"]


class Invoice(Base):
    """this class is a supplier invoice uploaded as a pdf or photo. the file is kept in
    the database (not on disk) so it survives redeploys on hosts with an
    ephemeral filesystem"""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), default="review", nullable=False, index=True)

    file_name = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    file_data = deferred(Column(LargeBinary, nullable=False))

    #these columns keep what was read from the document, even after a person edits
    #the matched values, so a bad read can be diagnosed later
    raw_text = deferred(Column(Text, nullable=True))
    used_ocr = Column(Boolean, default=False, nullable=False)
    read_issues = Column(Text, nullable=True)  #this line keeps a json list of issue codes
    supplier_name_raw = Column(String(255), nullable=True)
    supplier_tax_number = Column(String(50), nullable=True)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    invoice_number = Column(String(100), nullable=True, index=True)
    invoice_date = Column(Date, nullable=True)
    currency = Column(String(3), default="ALL", nullable=False)
    #this line keeps the lek per unit of `currency`, used to convert costs when booked
    exchange_rate = Column(Float, nullable=True)
    subtotal = Column(Float, nullable=True)
    vat_total = Column(Float, nullable=True)
    total = Column(Float, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    accepted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier")
    location = relationship("Location")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_id])
    lines = relationship(
        "InvoiceLine", back_populates="invoice", cascade="all, delete-orphan",
        order_by="InvoiceLine.line_no",
    )


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    line_no = Column(Integer, nullable=False)

    #these columns keep the row as printed on the invoice
    code = Column(String(100), nullable=True)
    raw_description = Column(String(500), nullable=True)
    raw_unit = Column(String(50), nullable=True)

    kind = Column(String(10), default="stock", nullable=False)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    unit_price = Column(Float, nullable=True)  #this line keeps the price without vat
    net_amount = Column(Float, nullable=True)
    vat_amount = Column(Float, nullable=True)
    gross_amount = Column(Float, nullable=True)

    #this line keeps the confidence: ok means every arithmetic check passed, check means it needs a person
    confidence = Column(String(10), default="check", nullable=False)
    issues = Column(Text, nullable=True)  #this line keeps a json list of issue codes

    #these columns say which material the line books into. when product_id is null on a
    #stock line, a new material is created from new_* on acceptance
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    match_method = Column(String(20), nullable=True)  #this line keeps how the match was made: alias / sku / name / manual
    new_name = Column(String(255), nullable=True)
    new_category = Column(String(100), nullable=True)
    new_min = Column(Float, nullable=True)

    invoice = relationship("Invoice", back_populates="lines")
    product = relationship("Product")
