"""Read-only movement history ("Historiku"). Stock changes only through
invoices, transfers and physical-count corrections, each of which records
its own movements."""
import math
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models.product import Product
from ..models.stock_movement import StockMovement
from ..models.user import User
from ..schemas.stock_movement import StockMovementListOut, StockMovementOut

router = APIRouter(prefix="/api/stock-movements", tags=["stock-movements"])

KIND_TYPES = {
    "in": ["Purchase Receipt", "Stock In", "Opening Balance"],
    "transfer": ["Warehouse Transfer Out", "Warehouse Transfer In"],
    "adjustment": ["Adjustment", "Adjustment In", "Adjustment Out"],
    "out": ["Stock Out"],
}


@router.get("", response_model=StockMovementListOut)
def list_movements(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    kind: Optional[str] = None,
    product_id: Optional[int] = None,
    location_id: Optional[int] = None,
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(StockMovement)
    if kind:
        if kind not in KIND_TYPES:
            raise HTTPException(status_code=400, detail=f"kind must be one of {list(KIND_TYPES)}")
        query = query.filter(StockMovement.movement_type.in_(KIND_TYPES[kind]))
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if location_id:
        query = query.filter(
            (StockMovement.source_location_id == location_id)
            | (StockMovement.destination_location_id == location_id)
        )
    if search:
        like = f"%{search.strip()}%"
        query = query.join(Product).filter(or_(
            Product.name.ilike(like), Product.sku.ilike(like), StockMovement.reference_number.ilike(like),
        ))
    if date_from:
        query = query.filter(StockMovement.movement_date >= date_from)
    if date_to:
        query = query.filter(StockMovement.movement_date <= date_to)

    query = query.order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return StockMovementListOut(
        items=[StockMovementOut.model_validate(m) for m in items],
        total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )
