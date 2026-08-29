from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
from .product import ProductSummary
from .user import UserSummary
from ..models.stock_movement import MOVEMENT_TYPES


class StockMovementBase(BaseModel):
    product_id: int
    movement_type: str
    quantity: float
    reason: Optional[str] = None
    movement_date: date
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    source_location_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    project_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    transfer_id: Optional[int] = None

    @field_validator("movement_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in MOVEMENT_TYPES:
            raise ValueError(f"movement_type must be one of: {', '.join(MOVEMENT_TYPES)}")
        return v

    @field_validator("quantity")
    @classmethod
    def positive_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementOut(StockMovementBase):
    id: int
    previous_quantity: Optional[float] = None
    new_quantity: Optional[float] = None
    user_id: int
    approved_by_id: Optional[int] = None
    received_by_id: Optional[int] = None
    product: Optional[ProductSummary] = None
    user: Optional[UserSummary] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StockMovementListOut(BaseModel):
    items: list[StockMovementOut]
    total: int
    page: int
    page_size: int
    total_pages: int
