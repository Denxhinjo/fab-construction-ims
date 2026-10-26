from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from .product import ProductSummary
from .user import UserSummary
from .location import LocationSummary


class StockMovementOut(BaseModel):
    id: int
    product_id: int
    movement_type: str
    quantity: float
    previous_quantity: Optional[float] = None
    new_quantity: Optional[float] = None
    reason: Optional[str] = None
    movement_date: date
    notes: Optional[str] = None
    reference_number: Optional[str] = None
    source_location_id: Optional[int] = None
    destination_location_id: Optional[int] = None
    transfer_id: Optional[int] = None
    invoice_id: Optional[int] = None
    user_id: int
    product: Optional[ProductSummary] = None
    user: Optional[UserSummary] = None
    source_location: Optional[LocationSummary] = None
    destination_location: Optional[LocationSummary] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StockMovementListOut(BaseModel):
    items: list[StockMovementOut]
    total: int
    page: int
    page_size: int
    total_pages: int
