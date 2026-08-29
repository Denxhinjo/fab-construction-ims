"""
Centralized inventory operations service.

All stock-changing operations should go through this module to ensure:
- Database transactions protect against concurrent modifications
- Both product.quantity (global total) and product_stock (per-location) are consistent
- Stock movements are always recorded with full audit context
- Stock cannot go negative without explicit permission
"""
from datetime import date
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models.product import Product
from ..models.product_stock import ProductStock
from ..models.stock_movement import StockMovement, INBOUND_TYPES, OUTBOUND_TYPES


def _get_or_create_stock(db: Session, product_id: int, location_id: int) -> ProductStock:
    """Return the ProductStock row for product+location, creating it at qty=0 if missing."""
    stock = (
        db.query(ProductStock)
        .filter(ProductStock.product_id == product_id, ProductStock.location_id == location_id)
        .with_for_update()
        .first()
    )
    if stock is None:
        stock = ProductStock(product_id=product_id, location_id=location_id, quantity=0.0, reserved_quantity=0.0)
        db.add(stock)
        db.flush()
    return stock


def get_stock(db: Session, product_id: int, location_id: int) -> ProductStock | None:
    """Return the ProductStock row without locking. None if no stock entry exists."""
    return (
        db.query(ProductStock)
        .filter(ProductStock.product_id == product_id, ProductStock.location_id == location_id)
        .first()
    )


def get_available(db: Session, product_id: int, location_id: int) -> float:
    """Return available quantity (on_hand - reserved) at a specific location."""
    stock = get_stock(db, product_id, location_id)
    if stock is None:
        return 0.0
    return max(0.0, stock.quantity - stock.reserved_quantity)


def reserve_stock(db: Session, product_id: int, location_id: int, quantity: float) -> None:
    """Reserve stock for a pending operation (e.g. approved material request)."""
    stock = _get_or_create_stock(db, product_id, location_id)
    available = stock.quantity - stock.reserved_quantity
    if available < quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient available stock. Available: {available:.2f}, Requested: {quantity:.2f}",
        )
    stock.reserved_quantity += quantity
    db.flush()


def release_reservation(db: Session, product_id: int, location_id: int, quantity: float) -> None:
    """Release a reservation without consuming the stock."""
    stock = get_stock(db, product_id, location_id)
    if stock is None:
        return
    stock.reserved_quantity = max(0.0, stock.reserved_quantity - quantity)
    db.flush()


def record_movement(
    db: Session,
    *,
    product_id: int,
    movement_type: str,
    quantity: float,
    user_id: int,
    movement_date: date,
    source_location_id: Optional[int] = None,
    destination_location_id: Optional[int] = None,
    project_id: Optional[int] = None,
    purchase_order_id: Optional[int] = None,
    transfer_id: Optional[int] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    reference_number: Optional[str] = None,
    approved_by_id: Optional[int] = None,
    received_by_id: Optional[int] = None,
    consume_reservation: bool = False,
) -> StockMovement:
    """
    Record a stock movement and update product_stock + product.quantity in one transaction.

    For INBOUND types (Purchase Receipt, Transfer In, Opening Balance, etc.):
        - Adds quantity to destination_location_id (or source_location_id if no dest).

    For OUTBOUND types (Transfer Out, Project Issue, Adjustment Out, etc.):
        - Removes quantity from source_location_id.
        - Checks available stock (on_hand - reserved).

    For "Adjustment" (legacy type, sets product.quantity to an absolute value):
        - Calculates delta and updates the relevant location stock.

    Caller must commit the session after this call returns.
    """
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")

    product = db.query(Product).filter(Product.id == product_id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    prev_qty = product.quantity
    new_qty = prev_qty

    if movement_type in INBOUND_TYPES:
        target_loc = destination_location_id or source_location_id or product.location_id
        if target_loc:
            loc_stock = _get_or_create_stock(db, product_id, target_loc)
            loc_stock.quantity += quantity
        new_qty = prev_qty + quantity

    elif movement_type in OUTBOUND_TYPES:
        src_loc = source_location_id or product.location_id
        if src_loc:
            loc_stock = _get_or_create_stock(db, product_id, src_loc)
            available = loc_stock.quantity - loc_stock.reserved_quantity
            if available < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient available stock at this location. Available: {available:.2f}, Requested: {quantity:.2f}",
                )
            loc_stock.quantity -= quantity
            if consume_reservation:
                loc_stock.reserved_quantity = max(0.0, loc_stock.reserved_quantity - quantity)
        elif product.quantity < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock. Available: {product.quantity:.2f}, Requested: {quantity:.2f}",
            )
        new_qty = prev_qty - quantity

    elif movement_type == "Adjustment":
        # Legacy: set quantity to absolute value
        target_loc = source_location_id or product.location_id
        delta = quantity - prev_qty
        if target_loc:
            loc_stock = _get_or_create_stock(db, product_id, target_loc)
            loc_stock.quantity = max(0.0, loc_stock.quantity + delta)
        new_qty = quantity

    product.quantity = new_qty

    movement = StockMovement(
        product_id=product_id,
        movement_type=movement_type,
        quantity=quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        user_id=user_id,
        movement_date=movement_date,
        source_location_id=source_location_id,
        destination_location_id=destination_location_id,
        project_id=project_id,
        purchase_order_id=purchase_order_id,
        transfer_id=transfer_id,
        reason=reason,
        notes=notes,
        reference_number=reference_number,
        approved_by_id=approved_by_id,
        received_by_id=received_by_id,
    )
    db.add(movement)
    db.flush()
    return movement


def generate_reference(db: Session, prefix: str, model_class, ref_column: str, year: int) -> str:
    """
    Generate a human-readable reference like 'TR-2026-0001'.
    Uses count+1 approach but with a sequence guard via UNIQUE constraint.
    """
    count = db.query(model_class).filter(
        getattr(model_class, ref_column).like(f"{prefix}-{year}-%")
    ).count()
    return f"{prefix}-{year}-{count + 1:04d}"
