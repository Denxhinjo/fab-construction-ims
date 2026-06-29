from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    manager_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    manager_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class LocationOut(LocationBase):
    id: int
    is_active: bool
    product_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LocationSummary(BaseModel):
    id: int
    name: str
    city: Optional[str] = None

    model_config = {"from_attributes": True}
