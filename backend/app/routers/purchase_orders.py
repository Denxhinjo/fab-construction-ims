from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, date, timezone
import io
import math

from ..database import get_db
from ..models.purchase_order import PurchaseOrder, PurchaseOrderItem
from ..schemas.purchase_order import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderOut,
    PurchaseOrderListOut, ReceivePOIn,
)
from ..dependencies import get_current_user
from ..models.user import User
from ..services.inventory_service import record_movement, generate_reference

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])

PROCUREMENT_ROLES = {"admin", "procurement", "warehouse_manager"}
APPROVAL_ROLES = {"admin", "warehouse_manager"}

ALLOWED_TRANSITIONS = {
    "DRAFT": ["PENDING_APPROVAL", "CANCELLED"],
    "PENDING_APPROVAL": ["APPROVED", "CANCELLED"],
    "APPROVED": ["SENT", "CANCELLED"],
    "SENT": ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
    "PARTIALLY_RECEIVED": ["RECEIVED", "CANCELLED"],
    "RECEIVED": [],
    "CANCELLED": [],
}


def _check_procurement(user: User):
    if user.role not in PROCUREMENT_ROLES:
        raise HTTPException(status_code=403, detail="Procurement access required")


@router.get("", response_model=PurchaseOrderListOut)
def list_purchase_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PROCUREMENT_ROLES and current_user.role != "finance" and current_user.role != "viewer":
        raise HTTPException(status_code=403, detail="Access denied")
    query = db.query(PurchaseOrder)
    if status:
        query = query.filter(PurchaseOrder.status == status)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if location_id:
        query = query.filter(PurchaseOrder.destination_location_id == location_id)
    query = query.order_by(PurchaseOrder.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return PurchaseOrderListOut(
        items=[PurchaseOrderOut.model_validate(po) for po in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_procurement(current_user)
    year = datetime.now(timezone.utc).year
    po_number = generate_reference(db, "PO", PurchaseOrder, "po_number", year)

    total_amount = sum(
        (item.quantity * (item.unit_cost or 0)) for item in payload.items
    )

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=payload.supplier_id,
        destination_location_id=payload.destination_location_id,
        order_date=payload.order_date,
        expected_delivery_date=payload.expected_delivery_date,
        notes=payload.notes,
        currency=payload.currency,
        total_amount=total_amount,
        created_by_id=current_user.id,
        status="DRAFT",
    )
    db.add(po)
    db.flush()

    for item_data in payload.items:
        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=item_data.product_id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            unit=item_data.unit,
        )
        db.add(item)

    db.commit()
    db.refresh(po)
    return PurchaseOrderOut.model_validate(po)


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PROCUREMENT_ROLES and current_user.role not in ("finance", "viewer"):
        raise HTTPException(status_code=403, detail="Access denied")
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrderOut.model_validate(po)


@router.put("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_procurement(current_user)
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status in ("RECEIVED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot modify a {po.status} purchase order")

    if payload.status and payload.status != po.status:
        allowed = ALLOWED_TRANSITIONS.get(po.status, [])
        if payload.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from {po.status} to {payload.status}. Allowed: {allowed}",
            )
        if payload.status == "APPROVED":
            if current_user.role not in APPROVAL_ROLES:
                raise HTTPException(status_code=403, detail="Only warehouse managers or admins can approve purchase orders")
            po.approved_by_id = current_user.id
            po.approved_at = datetime.now(timezone.utc)
        po.status = payload.status

    for field, value in payload.model_dump(exclude_unset=True, exclude={"status", "items"}).items():
        setattr(po, field, value)

    if payload.items is not None:
        if po.status != "DRAFT":
            raise HTTPException(status_code=400, detail="Items can only be modified when PO is in DRAFT status")
        for item in po.items:
            db.delete(item)
        db.flush()
        total_amount = 0.0
        for item_data in payload.items:
            item = PurchaseOrderItem(
                purchase_order_id=po.id,
                product_id=item_data.product_id,
                description=item_data.description,
                quantity=item_data.quantity,
                unit_cost=item_data.unit_cost,
                unit=item_data.unit,
            )
            db.add(item)
            total_amount += item_data.quantity * (item_data.unit_cost or 0)
        po.total_amount = total_amount

    db.commit()
    db.refresh(po)
    return PurchaseOrderOut.model_validate(po)


@router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_goods(
    po_id: int,
    payload: ReceivePOIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Receive goods against a purchase order, creating Purchase Receipt movements."""
    if current_user.role not in PROCUREMENT_ROLES:
        raise HTTPException(status_code=403, detail="Procurement access required")

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status not in ("APPROVED", "SENT", "PARTIALLY_RECEIVED"):
        raise HTTPException(status_code=400, detail="Purchase order must be APPROVED, SENT, or PARTIALLY_RECEIVED to receive goods")

    item_map = {item.id: item for item in po.items}

    for recv in payload.items:
        item = item_map.get(recv.item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"PO item {recv.item_id} not found")
        if item.product_id is None:
            continue  # Skip items without a product link
        remaining = item.quantity - item.received_quantity
        if recv.received_quantity > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot receive {recv.received_quantity} for item {recv.item_id}. Remaining: {remaining:.2f}",
            )
        if recv.received_quantity > 0:
            record_movement(
                db,
                product_id=item.product_id,
                movement_type="Purchase Receipt",
                quantity=recv.received_quantity,
                user_id=current_user.id,
                movement_date=date.today(),
                destination_location_id=po.destination_location_id,
                purchase_order_id=po.id,
                reason=f"Goods receipt for PO {po.po_number}",
                notes=payload.notes,
                reference_number=payload.delivery_note,
                received_by_id=current_user.id,
            )
            item.received_quantity += recv.received_quantity

            # Update product latest_cost if unit_cost provided
            if item.unit_cost and item.product_id:
                from ..models.product import Product
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.latest_cost = item.unit_cost

    # Determine new PO status
    all_received = all(item.received_quantity >= item.quantity for item in po.items)
    any_received = any(item.received_quantity > 0 for item in po.items)
    if all_received:
        po.status = "RECEIVED"
    elif any_received:
        po.status = "PARTIALLY_RECEIVED"

    db.commit()
    db.refresh(po)
    return PurchaseOrderOut.model_validate(po)


@router.get("/{po_id}/pdf")
def export_po_pdf(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in PROCUREMENT_ROLES and current_user.role not in ("finance", "viewer"):
        raise HTTPException(status_code=403, detail="Access denied")

    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, "PURCHASE ORDER", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 7, f"PO Number: {po.po_number}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 7, f"Status: {po.status.replace('_', ' ')}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    # PO details grid
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(95, 7, "Supplier", border=1, new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 7, "Destination Warehouse", border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(95, 7, po.supplier.name if po.supplier else "-", border=1, new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 7, po.destination_location.name if po.destination_location else "-", border=1, new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(95, 7, "Order Date", border=1, new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 7, "Expected Delivery", border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(95, 7, str(po.order_date) if po.order_date else "-", border=1, new_x="RIGHT", new_y="LAST")
    pdf.cell(95, 7, str(po.expected_delivery_date) if po.expected_delivery_date else "-", border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # Items table header
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(240, 240, 240)
    col_w = [80, 20, 25, 30, 35]
    headers = ["Description", "Unit", "Qty", f"Unit Cost ({po.currency})", f"Total ({po.currency})"]
    for w, h in zip(col_w, headers):
        pdf.cell(w, 8, h, border=1, fill=True, new_x="RIGHT", new_y="LAST")
    pdf.ln()

    # Items rows
    pdf.set_font("Helvetica", "", 10)
    for item in po.items:
        desc = item.product.name if item.product else (item.description or f"Item #{item.id}")
        unit_cost = item.unit_cost or 0.0
        total = item.quantity * unit_cost
        row = [
            desc[:45],
            item.unit,
            f"{item.quantity:g}",
            f"{unit_cost:,.2f}",
            f"{total:,.2f}",
        ]
        for w, val in zip(col_w, row):
            pdf.cell(w, 7, val, border=1, new_x="RIGHT", new_y="LAST")
        pdf.ln()

    # Grand total
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(sum(col_w[:4]), 8, "GRAND TOTAL", border=1, align="R", new_x="RIGHT", new_y="LAST")
    pdf.cell(col_w[4], 8, f"{po.total_amount:,.2f} {po.currency}", border=1, new_x="LMARGIN", new_y="NEXT")

    if po.notes:
        pdf.ln(5)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, "Notes:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, po.notes)

    buf = io.BytesIO(pdf.output())
    filename = f"PO-{po.po_number}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
