from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from .category import CategorySummary
from .location import LocationSummary
from .supplier import SupplierSummary


class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    quantity: float = 0
    unit: str = "pcs"
    min_stock_level: float = 0
    unit_price: Optional[float] = None
    location_id: Optional[int] = None
    supplier_id: Optional[int] = None
    status: str = "active"
    notes: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    min_stock_level: Optional[float] = None
    unit_price: Optional[float] = None
    location_id: Optional[int] = None
    supplier_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ProductOut(ProductBase):
    id: int
    image_url: Optional[str] = None
    is_low_stock: bool = False
    category: Optional[CategorySummary] = None
    location: Optional[LocationSummary] = None
    supplier: Optional[SupplierSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductSummary(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    quantity: float
    unit: str

    model_config = {"from_attributes": True}


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
    total_pages: int
