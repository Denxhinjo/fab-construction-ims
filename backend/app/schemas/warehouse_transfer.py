from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import datetime
from .user import UserSummary
from .location import LocationSummary
from .product import ProductSummary

TRANSFER_STATUSES = ["DRAFT", "PENDING", "APPROVED", "DISPATCHED", "IN_TRANSIT", "RECEIVED", "CANCELLED"]


class TransferItemCreate(BaseModel):
    product_id: int
    quantity: float
    notes: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v


class TransferItemOut(BaseModel):
    id: int
    product_id: int
    quantity: float
    received_quantity: float
    notes: Optional[str] = None
    product: Optional[ProductSummary] = None

    model_config = {"from_attributes": True}


class WarehouseTransferCreate(BaseModel):
    source_location_id: int
    destination_location_id: int
    notes: Optional[str] = None
    items: list[TransferItemCreate]

    @model_validator(mode="after")
    def different_locations(self):
        if self.source_location_id == self.destination_location_id:
            raise ValueError("Source and destination warehouses must be different")
        return self

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("Transfer must have at least one item")
        return v


class WarehouseTransferUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list[TransferItemCreate]] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None and v not in TRANSFER_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(TRANSFER_STATUSES)}")
        return v


class WarehouseTransferOut(BaseModel):
    id: int
    reference: str
    source_location_id: int
    destination_location_id: int
    status: str
    notes: Optional[str] = None
    requested_by_id: int
    approved_by_id: Optional[int] = None
    dispatched_by_id: Optional[int] = None
    received_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    source_location: Optional[LocationSummary] = None
    destination_location: Optional[LocationSummary] = None
    requested_by: Optional[UserSummary] = None
    approved_by: Optional[UserSummary] = None
    items: list[TransferItemOut] = []

    model_config = {"from_attributes": True}


class WarehouseTransferListOut(BaseModel):
    items: list[WarehouseTransferOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class ReceiveItemIn(BaseModel):
    item_id: int
    received_quantity: float

    @field_validator("received_quantity")
    @classmethod
    def qty_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Received quantity cannot be negative")
        return v


class ReceiveTransferIn(BaseModel):
    items: list[ReceiveItemIn]
    notes: Optional[str] = None
