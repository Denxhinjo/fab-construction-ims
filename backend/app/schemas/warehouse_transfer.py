from pydantic import BaseModel, field_validator, model_validator
from typing import Optional
from datetime import datetime
from .user import UserSummary
from .location import LocationSummary
from .product import ProductSummary


class TransferItemCreate(BaseModel):
    product_id: int
    quantity: float

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
    driver: Optional[str] = None
    notes: Optional[str] = None
    items: list[TransferItemCreate]

    @model_validator(mode="after")
    def different_locations(self):
        if self.source_location_id == self.destination_location_id:
            raise ValueError("Source and destination warehouses must be different")
        return self

    @field_validator("items")
    @classmethod
    def items_valid(cls, v):
        if not v:
            raise ValueError("Transfer must have at least one item")
        ids = [i.product_id for i in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Each material can appear only once in a transfer")
        return v


class WarehouseTransferOut(BaseModel):
    id: int
    reference: str
    source_location_id: int
    destination_location_id: int
    status: str
    notes: Optional[str] = None
    driver: Optional[str] = None
    requested_by_id: int
    dispatched_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    source_location: Optional[LocationSummary] = None
    destination_location: Optional[LocationSummary] = None
    requested_by: Optional[UserSummary] = None
    received_by: Optional[UserSummary] = None
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
    def qty_not_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Received quantity cannot be negative")
        return v


class ReceiveTransferIn(BaseModel):
    """Omit `items` when everything arrived. Otherwise list what actually
    arrived per item; any shortfall closes the transfer as received with
    differences."""
    items: Optional[list[ReceiveItemIn]] = None
    notes: Optional[str] = None
