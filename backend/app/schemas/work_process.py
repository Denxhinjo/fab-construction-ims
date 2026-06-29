from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
from .product import ProductSummary
from .user import UserSummary
from .location import LocationSummary


class WorkProcessBase(BaseModel):
    title: str
    description: Optional[str] = None
    product_id: Optional[int] = None
    assigned_user_id: Optional[int] = None
    location_id: Optional[int] = None
    status: str = "Not Started"
    priority: str = "Medium"
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    completion_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        allowed = ("Not Started", "Started", "In Process", "Done")
        if v not in allowed:
            raise ValueError(f"status must be one of: {allowed}")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        allowed = ("Low", "Medium", "High", "Critical")
        if v not in allowed:
            raise ValueError(f"priority must be one of: {allowed}")
        return v


class WorkProcessCreate(WorkProcessBase):
    pass


class WorkProcessUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    product_id: Optional[int] = None
    assigned_user_id: Optional[int] = None
    location_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    completion_date: Optional[date] = None
    notes: Optional[str] = None


class WorkProcessOut(WorkProcessBase):
    id: int
    product: Optional[ProductSummary] = None
    assigned_user: Optional[UserSummary] = None
    location: Optional[LocationSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkProcessListOut(BaseModel):
    items: list[WorkProcessOut]
    total: int
    page: int
    page_size: int
    total_pages: int
