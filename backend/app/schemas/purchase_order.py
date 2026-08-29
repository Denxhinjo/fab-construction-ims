from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from .user import UserSummary
from .location import LocationSummary
from .supplier import SupplierSummary
from .product import ProductSummary

PO_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]


class POItemCreate(BaseModel):
    product_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float
    unit_cost: Optional[float] = None
    unit: str = "pcs"

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v


class POItemOut(BaseModel):
    id: int
    product_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float
    received_quantity: float
    unit_cost: Optional[float] = None
    unit: str
    product: Optional[ProductSummary] = None

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    destination_location_id: int
    order_date: date
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    currency: str = "ALL"
    items: list[POItemCreate]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("Purchase order must have at least one item")
        return v


class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    items: Optional[list[POItemCreate]] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in PO_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(PO_STATUSES)}")
        return v


class PurchaseOrderOut(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    destination_location_id: int
    status: str
    order_date: date
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    total_amount: float
    currency: str
    created_by_id: int
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    supplier: Optional[SupplierSummary] = None
    destination_location: Optional[LocationSummary] = None
    created_by: Optional[UserSummary] = None
    approved_by: Optional[UserSummary] = None
    items: list[POItemOut] = []

    model_config = {"from_attributes": True}


class PurchaseOrderListOut(BaseModel):
    items: list[PurchaseOrderOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class ReceivePOItemIn(BaseModel):
    item_id: int
    received_quantity: float

    @field_validator("received_quantity")
    @classmethod
    def qty_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Received quantity cannot be negative")
        return v


class ReceivePOIn(BaseModel):
    items: list[ReceivePOItemIn]
    delivery_note: Optional[str] = None
    notes: Optional[str] = None
