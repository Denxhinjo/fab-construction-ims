from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies import get_current_user
from ..models.invoice import EDITABLE_INVOICE_STATUSES, Invoice
from ..models.location import Location
from ..models.product import Product
from ..models.product_stock import ProductStock
from ..models.stock_movement import StockMovement
from ..models.supplier import Supplier
from ..models.user import User
from ..models.warehouse_transfer import OPEN_TRANSFER_STATUSES, WarehouseTransfer
from ..schemas.stock_movement import StockMovementOut

router = APIRouter(prefix="/api", tags=["dashboard"])


def _below_min(db: Session) -> list[dict]:
    """this function lists every (material, warehouse) under its minimum, with the
    warehouse that could cover the gap by transfer: the one holding the most
    stock above its own minimum"""
    stocks = (
        db.query(ProductStock)
        .options(joinedload(ProductStock.product), joinedload(ProductStock.location))
        .join(Product, ProductStock.product_id == Product.id)
        .join(Location, ProductStock.location_id == Location.id)
        .filter(Product.status != "archived", Location.is_active == True)  # noqa: E712
        .all()
    )
    by_product: dict[int, list[ProductStock]] = {}
    for s in stocks:
        by_product.setdefault(s.product_id, []).append(s)

    result = []
    for s in stocks:
        if not s.is_below_min:
            continue
        need = s.effective_min - s.quantity
        donors = [
            (o.quantity - o.effective_min, o)
            for o in by_product[s.product_id]
            if o.location_id != s.location_id and o.quantity - o.effective_min > 0
        ]
        surplus, donor = max(donors, key=lambda d: d[0]) if donors else (0, None)
        result.append({
            "product_id": s.product_id,
            "product_name": s.product.name,
            "unit": s.product.unit,
            "location_id": s.location_id,
            "location_name": s.location.name,
            "quantity": s.quantity,
            "min": s.effective_min,
            "need": need,
            "source_location_id": donor.location_id if donor else None,
            "source_location_name": donor.location.name if donor else None,
            "source_quantity": donor.quantity if donor else None,
            "can_transfer": min(surplus, need) if donor else 0,
        })
    result.sort(key=lambda r: r["quantity"] / r["min"])
    return result


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    locations = db.query(Location).filter(Location.is_active == True).order_by(Location.id).all()  # noqa: E712
    below = _below_min(db)

    in_transit = (
        db.query(WarehouseTransfer)
        .filter(WarehouseTransfer.status.in_(OPEN_TRANSFER_STATUSES))
        .all()
    )
    incoming_by_loc: dict[int, int] = {}
    for t in in_transit:
        incoming_by_loc[t.destination_location_id] = incoming_by_loc.get(t.destination_location_id, 0) + 1

    depots = []
    for loc in locations:
        stocks = (
            db.query(ProductStock).options(joinedload(ProductStock.product))
            .join(Product)
            .filter(ProductStock.location_id == loc.id, Product.status != "archived")
            .all()
        )
        depots.append({
            "id": loc.id,
            "name": loc.name,
            "city": loc.city,
            "value": round(sum(s.quantity * s.product.cost for s in stocks if s.quantity > 0), 2),
            "materials": sum(1 for s in stocks if s.quantity > 0),
            "below_min": sum(1 for b in below if b["location_id"] == loc.id),
            "incoming": incoming_by_loc.get(loc.id, 0),
        })

    destinations = sorted({t.destination_location.name for t in in_transit})
    recent = (
        db.query(StockMovement)
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .limit(6)
        .all()
    )
    return {
        "todo": {
            "invoices_to_review": db.query(Invoice).filter(Invoice.status.in_(EDITABLE_INVOICE_STATUSES)).count(),
            "transfers_in_transit": len(in_transit),
            "transfer_destinations": destinations,
            "below_min": len(below),
            "below_min_coverable": sum(1 for b in below if b["can_transfer"] > 0),
        },
        "total_value": round(sum(d["value"] for d in depots), 2),
        "depots": depots,
        "recent_movements": [StockMovementOut.model_validate(m) for m in recent],
        "below_min": below[:8],
    }


@router.get("/dashboard/counts")
def nav_counts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """this function returns the badge numbers for the sidebar, cheap enough to poll"""
    return {
        "invoices_to_review": db.query(Invoice).filter(Invoice.status.in_(EDITABLE_INVOICE_STATUSES)).count(),
        "transfers_in_transit": db.query(WarehouseTransfer).filter(
            WarehouseTransfer.status.in_(OPEN_TRANSFER_STATUSES)
        ).count(),
    }


@router.get("/dashboard/below-min")
def below_min(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _below_min(db)


@router.get("/search")
def search(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    like = f"%{q.strip()}%"
    products = (
        db.query(Product)
        .filter(Product.status != "archived", or_(Product.name.ilike(like), Product.sku.ilike(like)))
        .order_by(Product.name).limit(6).all()
    )
    invoices = (
        db.query(Invoice).outerjoin(Supplier)
        .filter(or_(
            Invoice.invoice_number.ilike(like), Invoice.file_name.ilike(like),
            Supplier.name.ilike(like), Invoice.supplier_name_raw.ilike(like),
        ))
        .order_by(Invoice.created_at.desc()).limit(5).all()
    )
    transfers = (
        db.query(WarehouseTransfer)
        .filter(or_(WarehouseTransfer.reference.ilike(like), WarehouseTransfer.driver.ilike(like)))
        .order_by(WarehouseTransfer.created_at.desc()).limit(5).all()
    )
    return {
        "products": [{"id": p.id, "name": p.name, "sku": p.sku, "quantity": p.quantity, "unit": p.unit} for p in products],
        "invoices": [
            {
                "id": i.id, "status": i.status, "invoice_number": i.invoice_number,
                "supplier": i.supplier.name if i.supplier else i.supplier_name_raw, "file_name": i.file_name,
            }
            for i in invoices
        ],
        "transfers": [
            {
                "id": t.id, "reference": t.reference, "status": t.status,
                "source": t.source_location.name, "destination": t.destination_location.name,
            }
            for t in transfers
        ],
    }

