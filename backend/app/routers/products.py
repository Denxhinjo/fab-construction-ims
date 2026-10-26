import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies import get_current_user, require_admin
from ..models.category import Category
from ..models.location import Location
from ..models.product import Product
from ..models.product_stock import ProductStock
from ..models.stock_movement import StockMovement
from ..models.user import User
from ..schemas.product import (
    AdjustmentIn, ProductOut, ProductSummary, ProductWrite, StockCell, StockLocation, StockOut, StockRow,
)
from ..services.inventory_service import _get_or_create_stock, adjust_to_count, generate_reference
from ..services.permissions import require_location_access

router = APIRouter(prefix="/api/products", tags=["products"])
stock_router = APIRouter(prefix="/api/stock", tags=["stock"])


def _active_locations(db: Session) -> list[Location]:
    return db.query(Location).filter(Location.is_active == True).order_by(Location.id).all()  # noqa: E712


def _stock_rows(
    db: Session,
    locations: list[Location],
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    location_id: Optional[int] = None,
    below_min: bool = False,
) -> list[StockRow]:
    query = (
        db.query(Product)
        .options(joinedload(Product.location_stocks), joinedload(Product.category), joinedload(Product.supplier))
        .filter(Product.status != "archived")
    )
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    if category_id:
        query = query.filter(Product.category_id == category_id)

    rows = []
    for p in query.order_by(Product.name).all():
        by_loc = {s.location_id: s for s in p.location_stocks}
        cells = {}
        for loc in locations:
            s = by_loc.get(loc.id)
            qty = s.quantity if s else 0.0
            # A material's default minimum applies only where it is kept.
            minimum = s.effective_min if s else 0.0
            cells[loc.id] = StockCell(quantity=qty, min=minimum, below_min=minimum > 0 and qty < minimum)
        if location_id and (location_id not in cells or (cells[location_id].quantity == 0 and not cells[location_id].min)):
            continue
        if below_min:
            scope = [cells[location_id]] if location_id else cells.values()
            if not any(c.below_min for c in scope):
                continue
        rows.append(StockRow(
            id=p.id, name=p.name, sku=p.sku,
            category=p.category.name if p.category else None,
            unit=p.unit, total=sum(c.quantity for c in cells.values()),
            avg_cost=p.cost or None,
            last_supplier=p.supplier.name if p.supplier else None,
            min_stock_level=p.min_stock_level, notes=p.notes, cells=cells,
        ))
    return rows


# ─── Stock matrix ─────────────────────────────────────────────────────────────
@stock_router.get("", response_model=StockOut)
def get_stock(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    location_id: Optional[int] = None,
    below_min: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    locations = _active_locations(db)
    rows = _stock_rows(db, locations, search, category_id, location_id, below_min)
    total = db.query(Product).filter(Product.status != "archived").count()
    return StockOut(
        locations=[StockLocation(id=l.id, name=l.name) for l in locations],
        rows=rows,
        total_materials=total,
    )


@stock_router.get("/export")
def export_stock(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """CSV with a BOM and ';' separators, which Excel opens directly with
    Albanian characters intact."""
    locations = _active_locations(db)
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["Materiali", "SKU", "Kategoria", "Njësia", *[l.name for l in locations],
                     "Gjithsej", "Çmimi mesatar", "Furnizuesi i fundit"])
    for row in _stock_rows(db, locations):
        writer.writerow([
            row.name, row.sku or "", row.category or "", row.unit,
            *[f"{row.cells[l.id].quantity:g}" for l in locations],
            f"{row.total:g}",
            f"{row.avg_cost:.2f}".replace(".", ",") if row.avg_cost else "",
            row.last_supplier or "",
        ])
    filename = f"stoku-{datetime.now():%Y-%m-%d}.csv"
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@stock_router.post("/adjust", status_code=status.HTTP_201_CREATED)
def adjust_stock(
    payload: AdjustmentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Correct a warehouse's quantity to a physical count."""
    if current_user.role == "viewer":
        raise HTTPException(status_code=403, detail="Read-only users cannot change stock")
    require_location_access(current_user, payload.location_id, "You don't have access to this warehouse")
    if not db.get(Product, payload.product_id):
        raise HTTPException(status_code=404, detail="Material not found")
    reference = generate_reference(db, "KOR", StockMovement, "reference_number", datetime.now(timezone.utc).year)
    movement = adjust_to_count(
        db, product_id=payload.product_id, location_id=payload.location_id,
        counted=payload.counted_quantity, user_id=current_user.id,
        reference_number=reference, note=payload.note,
    )
    db.commit()
    return {"changed": movement is not None, "reference": reference if movement else None}


# ─── Materials ────────────────────────────────────────────────────────────────
@router.get("", response_model=list[ProductSummary])
def search_products(
    search: Optional[str] = None,
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lightweight list for pickers (invoice review, transfers)."""
    query = db.query(Product).filter(Product.status != "archived")
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(like), Product.sku.ilike(like)))
    return query.order_by(Product.name).limit(limit).all()


def _apply(db: Session, product: Product, payload: ProductWrite) -> None:
    if payload.sku:
        clash = db.query(Product).filter(func.lower(Product.sku) == payload.sku.lower(), Product.id != product.id).first()
        if clash:
            raise HTTPException(status_code=400, detail=f"SKU {payload.sku} is already used by {clash.name}")
    category_id = None
    if payload.category_name and payload.category_name.strip():
        name = payload.category_name.strip()
        category = db.query(Category).filter(func.lower(Category.name) == name.lower()).first()
        if category is None:
            category = Category(name=name)
            db.add(category)
            db.flush()
        category_id = category.id
    product.name = payload.name
    product.sku = payload.sku
    product.category_id = category_id
    product.unit = payload.unit.strip() or "copë"
    product.min_stock_level = payload.min_stock_level
    product.unit_price = payload.unit_price
    product.notes = payload.notes
    db.flush()
    for location_id, minimum in payload.location_mins.items():
        if not db.get(Location, location_id):
            raise HTTPException(status_code=400, detail="Warehouse not found")
        _get_or_create_stock(db, product.id, location_id).min_quantity = minimum


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductWrite, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    product = Product(name=payload.name, quantity=0)
    db.add(product)
    db.flush()
    _apply(db, product, payload)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Material not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int, payload: ProductWrite, db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    """Quantities are deliberately not editable here: they change only
    through invoices, transfers and physical-count corrections, so every
    change has a ledger entry."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Material not found")
    _apply(db, product, payload)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_product(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Archives rather than deletes, so the material's movement history survives."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Material not found")
    if product.quantity > 0:
        raise HTTPException(status_code=400, detail="Only materials with no stock left can be archived")
    product.status = "archived"
    product.archived_at = datetime.now(timezone.utc)
    product.archived_by_id = current_user.id
    db.commit()
