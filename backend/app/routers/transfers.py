"""
this file handles warehouse transfers. sending a transfer takes the stock out of
the source warehouse immediately, and it enters the destination when someone
there confirms what arrived. a shortfall closes the transfer as "received with
differences" and the missing quantity never enters stock
"""
import math
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models.location import Location
from ..models.product import Product
from ..models.user import User
from ..models.warehouse_transfer import OPEN_TRANSFER_STATUSES, WarehouseTransfer, WarehouseTransferItem
from ..schemas.warehouse_transfer import (
    ReceiveTransferIn, WarehouseTransferCreate, WarehouseTransferListOut, WarehouseTransferOut,
)
from ..services.inventory_service import generate_reference, record_movement
from ..services.permissions import require_location_access

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

#this dictionary maps the filter groups the ui asks for to stored statuses
STATUS_GROUPS = {
    "open": list(OPEN_TRANSFER_STATUSES),
    "closed": ["RECEIVED", "RECEIVED_PARTIAL"],
}


def _writer(user: User) -> None:
    if user.role == "viewer":
        raise HTTPException(status_code=403, detail="Read-only users cannot move stock")


@router.get("", response_model=WarehouseTransferListOut)
def list_transfers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(WarehouseTransfer)
    if status_filter:
        query = query.filter(WarehouseTransfer.status.in_(STATUS_GROUPS.get(status_filter, [status_filter])))
    if location_id:
        query = query.filter(
            (WarehouseTransfer.source_location_id == location_id)
            | (WarehouseTransfer.destination_location_id == location_id)
        )
    order = WarehouseTransfer.received_at.desc() if status_filter == "closed" else WarehouseTransfer.created_at.desc()
    query = query.order_by(order, WarehouseTransfer.id.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return WarehouseTransferListOut(
        items=[WarehouseTransferOut.model_validate(t) for t in items],
        total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=WarehouseTransferOut, status_code=status.HTTP_201_CREATED)
def send_transfer(
    payload: WarehouseTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _writer(current_user)
    for loc_id in (payload.source_location_id, payload.destination_location_id):
        if not db.get(Location, loc_id):
            raise HTTPException(status_code=400, detail="Warehouse not found")
    require_location_access(current_user, payload.source_location_id, "You can't send from this warehouse")

    now = datetime.now(timezone.utc)
    transfer = WarehouseTransfer(
        reference=generate_reference(db, "TR", WarehouseTransfer, "reference", now.year),
        source_location_id=payload.source_location_id,
        destination_location_id=payload.destination_location_id,
        driver=(payload.driver or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        requested_by_id=current_user.id,
        dispatched_by_id=current_user.id,
        dispatched_at=now,
        status="IN_TRANSIT",
    )
    db.add(transfer)
    db.flush()

    for item_data in payload.items:
        if not db.get(Product, item_data.product_id):
            raise HTTPException(status_code=400, detail="Material not found")
        db.add(WarehouseTransferItem(
            transfer_id=transfer.id, product_id=item_data.product_id, quantity=item_data.quantity,
        ))
        record_movement(
            db,
            product_id=item_data.product_id,
            movement_type="Warehouse Transfer Out",
            quantity=item_data.quantity,
            user_id=current_user.id,
            movement_date=date.today(),
            source_location_id=transfer.source_location_id,
            destination_location_id=transfer.destination_location_id,
            transfer_id=transfer.id,
            reference_number=transfer.reference,
        )

    db.commit()
    db.refresh(transfer)
    return WarehouseTransferOut.model_validate(transfer)


@router.get("/{transfer_id}", response_model=WarehouseTransferOut)
def get_transfer(transfer_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    transfer = db.get(WarehouseTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return WarehouseTransferOut.model_validate(transfer)


@router.post("/{transfer_id}/receive", response_model=WarehouseTransferOut)
def receive_transfer(
    transfer_id: int,
    payload: ReceiveTransferIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _writer(current_user)
    transfer = db.get(WarehouseTransfer, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status not in OPEN_TRANSFER_STATUSES:
        raise HTTPException(status_code=400, detail="This transfer has already been received")
    require_location_access(current_user, transfer.destination_location_id, "You can't receive into this warehouse")

    if payload.items is None:
        arrived = {item.id: item.quantity - item.received_quantity for item in transfer.items}
    else:
        item_ids = {item.id for item in transfer.items}
        arrived = {}
        for recv in payload.items:
            if recv.item_id not in item_ids:
                raise HTTPException(status_code=400, detail=f"Transfer item {recv.item_id} not found")
            arrived[recv.item_id] = recv.received_quantity

    for item in transfer.items:
        remaining = item.quantity - item.received_quantity
        qty = arrived.get(item.id, 0.0)
        if qty > remaining + 1e-9:
            raise HTTPException(
                status_code=400,
                detail=f"{item.product.name}: received {qty:g} but only {remaining:g} were sent",
            )
        if qty > 0:
            record_movement(
                db,
                product_id=item.product_id,
                movement_type="Warehouse Transfer In",
                quantity=qty,
                user_id=current_user.id,
                movement_date=date.today(),
                source_location_id=transfer.source_location_id,
                destination_location_id=transfer.destination_location_id,
                transfer_id=transfer.id,
                reference_number=transfer.reference,
                received_by_id=current_user.id,
            )
            item.received_quantity += qty
        short = item.quantity - item.received_quantity
        if short > 1e-9:
            item.notes = f"Mungojnë {short:g}"

    complete = all(item.received_quantity >= item.quantity - 1e-9 for item in transfer.items)
    transfer.status = "RECEIVED" if complete else "RECEIVED_PARTIAL"
    transfer.received_by_id = current_user.id
    transfer.received_at = datetime.now(timezone.utc)
    if payload.notes:
        transfer.notes = f"{transfer.notes}\n{payload.notes}" if transfer.notes else payload.notes

    db.commit()
    db.refresh(transfer)
    return WarehouseTransferOut.model_validate(transfer)
