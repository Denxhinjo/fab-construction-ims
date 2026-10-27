from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from .category import CategorySummary
from .supplier import SupplierSummary


class ProductWrite(BaseModel):
    name: str
    sku: Optional[str] = None
    #this line takes free text, and an unknown name creates the category
    category_name: Optional[str] = None
    unit: str = "copë"
    min_stock_level: float = 0
    unit_price: Optional[float] = None
    notes: Optional[str] = None
    #this line takes per-warehouse minimums keyed by location id, warehouses left out keep theirs
    location_mins: dict[int, Optional[float]] = {}

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("sku")
    @classmethod
    def blank_sku_is_none(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() or None if v else None


class ProductOut(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    unit: str
    quantity: float
    min_stock_level: float
    unit_price: Optional[float] = None
    avg_cost: Optional[float] = None
    latest_cost: Optional[float] = None
    status: str
    notes: Optional[str] = None
    category: Optional[CategorySummary] = None
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


#this section is the stock matrix: one row per material, one cell per warehouse
class StockCell(BaseModel):
    quantity: float
    min: float
    below_min: bool


class StockRow(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    unit: str
    total: float
    avg_cost: Optional[float] = None
    last_supplier: Optional[str] = None
    min_stock_level: float
    notes: Optional[str] = None
    cells: dict[int, StockCell]


class StockLocation(BaseModel):
    id: int
    name: str


class StockOut(BaseModel):
    locations: list[StockLocation]
    rows: list[StockRow]
    total_materials: int


class AdjustmentIn(BaseModel):
    product_id: int
    location_id: int
    counted_quantity: float
    note: Optional[str] = None

    @field_validator("counted_quantity")
    @classmethod
    def not_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Counted quantity cannot be negative")
        return v
