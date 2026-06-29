from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
from .product import ProductSummary
from .user import UserSummary


class StockMovementBase(BaseModel):
    product_id: int
    movement_type: str
    quantity: float
    reason: Optional[str] = None
    movement_date: date
    notes: Optional[str] = None
    reference_number: Optional[str] = None

    @field_validator("movement_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        allowed = ("Stock In", "Stock Out", "Adjustment")
        if v not in allowed:
            raise ValueError(f"movement_type must be one of: {allowed}")
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
