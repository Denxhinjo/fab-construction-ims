import json
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import datetime, date
from .location import LocationSummary
from .supplier import SupplierSummary
from .product import ProductSummary
from .user import UserSummary
from ..models.invoice import LINE_KINDS


def _issues(value) -> list[str]:
    if isinstance(value, list):
        return value
    return json.loads(value) if value else []


class InvoiceLineOut(BaseModel):
    id: int
    line_no: int
    code: Optional[str] = None
    raw_description: Optional[str] = None
    raw_unit: Optional[str] = None
    kind: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    net_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    gross_amount: Optional[float] = None
    confidence: str
    issues: list[str] = []
    product_id: Optional[int] = None
    match_method: Optional[str] = None
    new_name: Optional[str] = None
    new_category: Optional[str] = None
    new_min: Optional[float] = None
    product: Optional[ProductSummary] = None

    model_config = {"from_attributes": True}

    @field_validator("issues", mode="before")
    @classmethod
    def parse_issues(cls, v):
        return _issues(v)


class InvoiceListItem(BaseModel):
    id: int
    status: str
    file_name: str
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    supplier_name: Optional[str] = None
    line_count: int
    total: Optional[float] = None
    currency: str
    location: Optional[LocationSummary] = None
    created_at: datetime


class InvoiceListOut(BaseModel):
    items: list[InvoiceListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    counts: dict[str, int]


class InvoiceOut(BaseModel):
    id: int
    status: str
    file_name: str
    content_type: str
    file_size: int
    used_ocr: bool
    read_issues: list[str] = []
    supplier_name_raw: Optional[str] = None
    supplier_tax_number: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier: Optional[SupplierSummary] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    currency: str
    exchange_rate: Optional[float] = None
    subtotal: Optional[float] = None
    vat_total: Optional[float] = None
    total: Optional[float] = None
    location_id: Optional[int] = None
    location: Optional[LocationSummary] = None
    uploaded_by: Optional[UserSummary] = None
    accepted_by: Optional[UserSummary] = None
    accepted_at: Optional[datetime] = None
    created_at: datetime
    lines: list[InvoiceLineOut] = []
    #these fields are filled in by the router
    duplicate_of: Optional[int] = None
    review_queue: list[int] = []

    model_config = {"from_attributes": True}

    @field_validator("read_issues", mode="before")
    @classmethod
    def parse_read_issues(cls, v):
        return _issues(v)


class InvoiceLineIn(BaseModel):
    id: Optional[int] = None  #this line is None for a row added by hand
    kind: str = "stock"
    raw_description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    product_id: Optional[int] = None
    new_name: Optional[str] = None
    new_category: Optional[str] = None
    new_min: Optional[float] = None

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, v: str) -> str:
        if v not in LINE_KINDS:
            raise ValueError(f"kind must be one of {LINE_KINDS}")
        return v


class NewSupplierIn(BaseModel):
    name: str
    tax_number: Optional[str] = None


class InvoiceUpdate(BaseModel):
    supplier_id: Optional[int] = None
    new_supplier: Optional[NewSupplierIn] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    location_id: Optional[int] = None
    #this line replaces the invoice's rows when given, and rows not listed are removed
    lines: Optional[list[InvoiceLineIn]] = None

    @model_validator(mode="after")
    def one_supplier(self):
        if self.supplier_id and self.new_supplier:
            raise ValueError("Pick an existing supplier or a new one, not both")
        return self


class InvoiceAccept(InvoiceUpdate):
    #this line is set after the user has seen the "already booked" warning
    allow_duplicate: bool = False
