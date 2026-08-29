from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date, timezone
import math

from ..database import get_db
from ..models.warehouse_transfer import WarehouseTransfer, WarehouseTransferItem
from ..schemas.warehouse_transfer import (
    WarehouseTransferCreate, WarehouseTransferUpdate, WarehouseTransferOut,
    WarehouseTransferListOut, ReceiveTransferIn,
)
from ..dependencies import get_current_user
from ..models.user import User
from ..services.inventory_service import record_movement, generate_reference

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

ALLOWED_TRANSITIONS = {
    "DRAFT": ["PENDING", "CANCELLED"],
    "PENDING": ["APPROVED", "CANCELLED"],
    "APPROVED": ["DISPATCHED", "CANCELLED"],
    "DISPATCHED": ["IN_TRANSIT", "RECEIVED"],
    "IN_TRANSIT": ["RECEIVED"],
    "RECEIVED": [],
    "CANCELLED": [],
}

MANAGER_ROLES = {"admin", "warehouse_manager"}


def _check_manager(user: User):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Warehouse manager or admin access required")


@router.get("", response_model=WarehouseTransferListOut)
def list_transfers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    source_location_id: Optional[int] = None,
    destination_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WarehouseTransfer)
    if status:
        query = query.filter(WarehouseTransfer.status == status)
    if source_location_id:
        query = query.filter(WarehouseTransfer.source_location_id == source_location_id)
    if destination_location_id:
        query = query.filter(WarehouseTransfer.destination_location_id == destination_location_id)
    query = query.order_by(WarehouseTransfer.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return WarehouseTransferListOut(
        items=[WarehouseTransferOut.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=WarehouseTransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: WarehouseTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year = datetime.now(timezone.utc).year
    reference = generate_reference(db, "TR", WarehouseTransfer, "reference", year)

    transfer = WarehouseTransfer(
        reference=reference,
        source_location_id=payload.source_location_id,
        destination_location_id=payload.destination_location_id,
        notes=payload.notes,
        requested_by_id=current_user.id,
        status="DRAFT",
    )
    db.add(transfer)
    db.flush()

    for item_data in payload.items:
        item = WarehouseTransferItem(
            transfer_id=transfer.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            notes=item_data.notes,
        )
        db.add(item)

    db.commit()
    db.refresh(transfer)
    return WarehouseTransferOut.model_validate(transfer)


@router.get("/{transfer_id}", response_model=WarehouseTransferOut)
def get_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transfer = db.query(WarehouseTransfer).filter(WarehouseTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return WarehouseTransferOut.model_validate(transfer)


@router.put("/{transfer_id}", response_model=WarehouseTransferOut)
def update_transfer(
    transfer_id: int,
    payload: WarehouseTransferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transfer = db.query(WarehouseTransfer).filter(WarehouseTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if payload.status and payload.status != transfer.status:
        allowed = ALLOWED_TRANSITIONS.get(transfer.status, [])
        if payload.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from {transfer.status} to {payload.status}. Allowed: {allowed}",
            )

        if payload.status == "APPROVED":
            _check_manager(current_user)
            transfer.approved_by_id = current_user.id
            transfer.approved_at = datetime.now(timezone.utc)

        elif payload.status == "DISPATCHED":
            _check_manager(current_user)
            transfer.dispatched_by_id = current_user.id
            transfer.dispatched_at = datetime.now(timezone.utc)
            # Create WAREHOUSE_TRANSFER_OUT movements for each item
            for item in transfer.items:
                record_movement(
                    db,
                    product_id=item.product_id,
                    movement_type="Warehouse Transfer Out",
                    quantity=item.quantity,
                    user_id=current_user.id,
                    movement_date=date.today(),
                    source_location_id=transfer.source_location_id,
                    destination_location_id=transfer.destination_location_id,
                    transfer_id=transfer.id,
                    reason=f"Transfer {transfer.reference} dispatched",
                )

        transfer.status = payload.status

    if payload.notes is not None:
        transfer.notes = payload.notes

    # Allow item updates only in DRAFT status
    if payload.items is not None:
        if transfer.status != "DRAFT":
            raise HTTPException(status_code=400, detail="Items can only be modified when transfer is in DRAFT status")
        for item in transfer.items:
            db.delete(item)
        db.flush()
        for item_data in payload.items:
            item = WarehouseTransferItem(
                transfer_id=transfer.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                notes=item_data.notes,
            )
            db.add(item)

    db.commit()
    db.refresh(transfer)
    return WarehouseTransferOut.model_validate(transfer)


@router.post("/{transfer_id}/receive", response_model=WarehouseTransferOut)
def receive_transfer(
    transfer_id: int,
    payload: ReceiveTransferIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark items as received, creating WAREHOUSE_TRANSFER_IN movements."""
    transfer = db.query(WarehouseTransfer).filter(WarehouseTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status not in ("DISPATCHED", "IN_TRANSIT"):
        raise HTTPException(status_code=400, detail="Transfer must be DISPATCHED or IN_TRANSIT to receive")
    if transfer.status == "RECEIVED":
        raise HTTPException(status_code=400, detail="Transfer has already been fully received")

    item_map = {item.id: item for item in transfer.items}

    for recv in payload.items:
        item = item_map.get(recv.item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Transfer item {recv.item_id} not found")
        remaining = item.quantity - item.received_quantity
        if recv.received_quantity > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive {recv.received_quantity} for item {recv.item_id}. Remaining: {remaining}",
            )
        if recv.received_quantity > 0:
            record_movement(
                db,
                product_id=item.product_id,
                movement_type="Warehouse Transfer In",
                quantity=recv.received_quantity,
                user_id=current_user.id,
                movement_date=date.today(),
                source_location_id=transfer.source_location_id,
                destination_location_id=transfer.destination_location_id,
                transfer_id=transfer.id,
                reason=f"Transfer {transfer.reference} received",
                received_by_id=current_user.id,
            )
            item.received_quantity += recv.received_quantity

    # Determine if fully received
    all_received = all(item.received_quantity >= item.quantity for item in transfer.items)
    transfer.status = "RECEIVED" if all_received else "IN_TRANSIT"
    if all_received:
        transfer.received_by_id = current_user.id
        transfer.received_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(transfer)
    return WarehouseTransferOut.model_validate(transfer)
