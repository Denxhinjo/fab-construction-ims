from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import math
from ..database import get_db
from ..models.stock_movement import StockMovement, MOVEMENT_TYPES
from ..models.product import Product
from ..schemas.stock_movement import StockMovementCreate, StockMovementOut, StockMovementListOut
from ..dependencies import get_current_user
from ..models.user import User
from ..services.permissions import permitted_location_ids, require_location_access
from ..services.inventory_service import record_movement

router = APIRouter(prefix="/api/stock-movements", tags=["stock-movements"])


@router.get("", response_model=StockMovementListOut)
def list_movements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    product_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    location_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(StockMovement)
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    if date_from:
        query = query.filter(StockMovement.movement_date >= date_from)
    if date_to:
        query = query.filter(StockMovement.movement_date <= date_to)
    if location_id:
        query = query.filter(
            (StockMovement.source_location_id == location_id) |
            (StockMovement.destination_location_id == location_id)
        )
    if project_id:
        query = query.filter(StockMovement.project_id == project_id)

    # Non-admins only see movements for products in their permitted locations
    if current_user.role not in ("admin", "warehouse_manager", "procurement"):
        query = query.join(Product, StockMovement.product_id == Product.id).filter(
            Product.location_id.in_(permitted_location_ids(current_user))
        )

    query = query.order_by(StockMovement.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return StockMovementListOut(
        items=[StockMovementOut.model_validate(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED)
def create_movement(
    payload: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Location access check for non-admins
    if current_user.role not in ("admin", "warehouse_manager"):
        check_loc = payload.source_location_id or product.location_id
        require_location_access(
            current_user,
            check_loc,
            "You don't have permission to record movements for this product's location",
        )

    movement = record_movement(
        db,
        product_id=payload.product_id,
        movement_type=payload.movement_type,
        quantity=payload.quantity,
        user_id=current_user.id,
        movement_date=payload.movement_date,
        source_location_id=payload.source_location_id or product.location_id,
        destination_location_id=payload.destination_location_id,
        project_id=payload.project_id,
        purchase_order_id=payload.purchase_order_id,
        transfer_id=payload.transfer_id,
        reason=payload.reason,
        notes=payload.notes,
        reference_number=payload.reference_number,
    )
    db.commit()
    db.refresh(movement)
    return StockMovementOut.model_validate(movement)


@router.get("/types", response_model=list[str])
def get_movement_types(current_user: User = Depends(get_current_user)):
    """Return all valid movement type values."""
    return MOVEMENT_TYPES


@router.get("/{movement_id}", response_model=StockMovementOut)
def get_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(StockMovement).filter(StockMovement.id == movement_id).first()
    if not movement:
        raise HTTPException(status_code=404, detail="Stock movement not found")

    if current_user.role not in ("admin", "warehouse_manager"):
        product = db.query(Product).filter(Product.id == movement.product_id).first()
        require_location_access(
            current_user,
            product.location_id if product else None,
            "You don't have access to this movement's location",
        )

    return StockMovementOut.model_validate(movement)
