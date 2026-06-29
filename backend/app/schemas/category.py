from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#F59E0B"


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class CategoryOut(CategoryBase):
    id: int
    product_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategorySummary(BaseModel):
    id: int
    name: str
    color: Optional[str] = None

    model_config = {"from_attributes": True}
