from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import math
from ..database import get_db
from ..models.stock_movement import StockMovement
from ..models.product import Product
from ..schemas.stock_movement import StockMovementCreate, StockMovementOut, StockMovementListOut
from ..dependencies import get_current_user
from ..models.user import User
from ..services.permissions import permitted_location_ids, require_location_access

router = APIRouter(prefix="/api/stock-movements", tags=["stock-movements"])


@router.get("", response_model=StockMovementListOut)
def list_movements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    product_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
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

    # Non-admins only ever see movements against products in warehouses
    # they've been granted access to -- StockMovement has no location_id of
    # its own, so this scopes through the product it's against.
    if current_user.role != "admin":
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

    require_location_access(
        current_user,
        product.location_id,
        "You don't have permission to record movements for this product's location",
    )

    previous_qty = product.quantity

    if payload.movement_type == "Stock In":
        new_qty = previous_qty + payload.quantity
    elif payload.movement_type == "Stock Out":
        if previous_qty < payload.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock for Stock Out")
        new_qty = previous_qty - payload.quantity
    else:  # Adjustment
        new_qty = payload.quantity

    product.quantity = new_qty

    movement = StockMovement(
        **payload.model_dump(),
        user_id=current_user.id,
        previous_quantity=previous_qty,
        new_quantity=new_qty,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return StockMovementOut.model_validate(movement)


@router.get("/{movement_id}", response_model=StockMovementOut)
def get_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.query(StockMovement).filter(StockMovement.id == movement_id).first()
    if not movement:
        raise HTTPException(status_code=404, detail="Stock movement not found")

    product = db.query(Product).filter(Product.id == movement.product_id).first()
    require_location_access(
        current_user,
        product.location_id if product else None,
        "You don't have access to this movement's location",
    )

    return StockMovementOut.model_validate(movement)
