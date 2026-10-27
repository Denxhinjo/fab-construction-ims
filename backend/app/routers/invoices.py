"""
this file handles supplier invoices ("Pranimet")

upload  -> the file is read (text layer or ocr), parsed and matched, and the
           invoice lands in "review" (or "failed" when nothing could be read)
review  -> a person corrects the supplier, rows and matches, and PUT saves that
           for later without touching stock
accept  -> the stock rows are booked into the chosen warehouse as purchase
           receipt movements, new materials are created, average costs are
           updated and supplier aliases are remembered for the next invoice
"""
import json
import logging
import math
import re
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, undefer

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models.category import Category
from ..models.invoice import EDITABLE_INVOICE_STATUSES, Invoice, InvoiceLine
from ..models.location import Location
from ..models.product import Product
from ..models.product_stock import ProductStock
from ..models.supplier import Supplier
from ..models.user import User
from ..schemas.invoice import (
    InvoiceAccept, InvoiceListItem, InvoiceListOut, InvoiceOut, InvoiceUpdate,
)
from ..schemas.location import LocationSummary
from ..services import invoice_matching as matching
from ..services.inventory_service import apply_purchase_cost, record_movement
from ..services.invoice_parser import parse_invoice
from ..services.invoice_reader import OcrUnavailable, UnsupportedFile, detect_kind, read_document
from ..services.permissions import require_location_access

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/invoices", tags=["invoices"])

#this line sets lek as the currency stock values and average costs are kept in
HOME_CURRENCY = "ALL"



def _content_type(kind: str, data: bytes) -> str:
    #this line uses the file type found in the bytes we checked, not the browser's content-type header
    if kind == "pdf":
        return "application/pdf"
    return "image/png" if data.startswith(b"\x89PNG") else "image/jpeg"


def require_writer(user: User = Depends(get_current_user)) -> User:
    if user.role == "viewer":
        raise HTTPException(status_code=403, detail="Read-only users cannot change invoices")
    return user


def _get(db: Session, invoice_id: int) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


def _duplicate_of(db: Session, inv: Invoice) -> Optional[int]:
    if not inv.supplier_id or not inv.invoice_number:
        return None
    other = (
        db.query(Invoice.id)
        .filter(
            Invoice.id != inv.id,
            Invoice.supplier_id == inv.supplier_id,
            Invoice.invoice_number == inv.invoice_number,
            Invoice.status == "accepted",
        )
        .first()
    )
    return other[0] if other else None


def _out(db: Session, inv: Invoice) -> InvoiceOut:
    out = InvoiceOut.model_validate(inv)
    out.duplicate_of = _duplicate_of(db, inv)
    out.review_queue = [
        row[0] for row in db.query(Invoice.id)
        .filter(Invoice.status.in_(EDITABLE_INVOICE_STATUSES))
        .order_by(Invoice.created_at.asc())
        .all()
    ]
    return out


#this section lists and reads invoices
@router.get("", response_model=InvoiceListOut)
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Invoice)
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    line_counts = dict(
        db.query(InvoiceLine.invoice_id, func.count(InvoiceLine.id))
        .filter(InvoiceLine.invoice_id.in_([i.id for i in invoices]), InvoiceLine.kind != "skip")
        .group_by(InvoiceLine.invoice_id)
        .all()
    )
    counts = dict(db.query(Invoice.status, func.count(Invoice.id)).group_by(Invoice.status).all())
    counts["all"] = sum(counts.values())

    items = [
        InvoiceListItem(
            id=i.id,
            status=i.status,
            file_name=i.file_name,
            invoice_number=i.invoice_number,
            invoice_date=i.invoice_date,
            supplier_name=i.supplier.name if i.supplier else i.supplier_name_raw,
            line_count=line_counts.get(i.id, 0),
            total=i.total,
            currency=i.currency,
            location=LocationSummary.model_validate(i.location) if i.location else None,
            created_at=i.created_at,
        )
        for i in invoices
    ]
    return InvoiceListOut(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1, counts=counts,
    )


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _out(db, _get(db, invoice_id))


@router.get("/{invoice_id}/file")
def get_invoice_file(invoice_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    inv = db.query(Invoice).options(undefer(Invoice.file_data)).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Response(
        content=inv.file_data,
        media_type=inv.content_type,
        headers={"Content-Disposition": f'inline; filename="{inv.file_name}"'},
    )


#this section uploads and reads invoices
@router.post("", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
def upload_invoice(
    file: UploadFile = File(...),
    location_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_writer),
):
    data = file.file.read()
    if len(data) > settings.MAX_INVOICE_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File is larger than {settings.MAX_INVOICE_FILE_MB} MB")
    kind = detect_kind(data)
    if kind is None:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG and PNG files are accepted.")
    if location_id is not None and not db.query(Location).filter(Location.id == location_id).first():
        raise HTTPException(status_code=400, detail="Warehouse not found")

    inv = Invoice(
        file_name=(file.filename or "invoice")[:255],
        content_type=_content_type(kind, data),
        file_size=len(data),
        file_data=data,
        location_id=location_id,
        uploaded_by_id=current_user.id,
        status="review",
    )
    db.add(inv)

    issues: list[str] = []
    try:
        result = read_document(data)
        inv.used_ocr = result.used_ocr
        inv.raw_text = result.text
        parsed = parse_invoice(result.text)
        issues = parsed.issues
    except OcrUnavailable:
        parsed, issues = None, ["ocr_unavailable"]
    except UnsupportedFile as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:  #this line makes sure a broken file never loses the upload
        log.exception("Reading invoice %s failed", inv.file_name)
        parsed, issues = None, ["read_error"]

    if parsed is not None:
        inv.invoice_number = parsed.invoice_number
        inv.invoice_date = parsed.invoice_date
        inv.supplier_name_raw = parsed.supplier_name
        inv.supplier_tax_number = parsed.supplier_tax_number
        inv.currency = parsed.currency
        inv.exchange_rate = parsed.exchange_rate
        inv.subtotal, inv.vat_total, inv.total = parsed.subtotal, parsed.vat_total, parsed.total

        supplier = matching.match_supplier(db, parsed.supplier_name, parsed.supplier_tax_number)
        inv.supplier_id = supplier.id if supplier else None
        products = db.query(Product).filter(Product.status != "archived").all()

        for row in parsed.lines:
            line = InvoiceLine(
                line_no=row.line_no, code=row.code, raw_description=row.description[:500],
                raw_unit=row.raw_unit, kind=row.kind, quantity=row.quantity, unit=row.unit,
                unit_price=row.unit_price, net_amount=row.net_amount, vat_amount=row.vat_amount,
                gross_amount=row.gross_amount, confidence=row.confidence,
                issues=json.dumps(row.issues) if row.issues else None,
            )
            if row.kind == "stock":
                product, method = matching.match_product(
                    db, inv.supplier_id, row.code, row.description, products,
                )
                if product:
                    line.product_id, line.match_method = product.id, method
                    line.unit = line.unit or product.unit
                else:
                    line.new_name = matching.suggested_name(row.description)
            inv.lines.append(line)

    if parsed is None or (not parsed.lines and not parsed.invoice_number):
        inv.status = "failed"
    inv.read_issues = json.dumps(issues) if issues else None
    db.commit()
    db.refresh(inv)
    return _out(db, inv)


#this section saves, rejects and accepts reviewed invoices
def _apply_update(db: Session, inv: Invoice, payload: InvoiceUpdate) -> None:
    if inv.status not in EDITABLE_INVOICE_STATUSES:
        raise HTTPException(status_code=400, detail="This invoice is already closed")
    fields = payload.model_fields_set

    if payload.new_supplier is not None:
        name = payload.new_supplier.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Supplier name is required")
        supplier = Supplier(name=name, tax_number=matching.normalize_tax_number(payload.new_supplier.tax_number) or None)
        db.add(supplier)
        db.flush()
        inv.supplier_id = supplier.id
    elif "supplier_id" in fields:
        if payload.supplier_id and not db.get(Supplier, payload.supplier_id):
            raise HTTPException(status_code=400, detail="Supplier not found")
        inv.supplier_id = payload.supplier_id

    if "invoice_number" in fields:
        inv.invoice_number = (payload.invoice_number or "").strip() or None
    if "invoice_date" in fields:
        inv.invoice_date = payload.invoice_date
    if "currency" in fields and payload.currency:
        currency = payload.currency.strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise HTTPException(status_code=400, detail="Currency must be a 3-letter code such as ALL or EUR")
        inv.currency = currency
    if "exchange_rate" in fields:
        if payload.exchange_rate is not None and payload.exchange_rate <= 0:
            raise HTTPException(status_code=400, detail="The exchange rate must be greater than zero")
        inv.exchange_rate = payload.exchange_rate
    if "location_id" in fields:
        if payload.location_id and not db.get(Location, payload.location_id):
            raise HTTPException(status_code=400, detail="Warehouse not found")
        inv.location_id = payload.location_id

    if payload.lines is not None:
        existing = {line.id: line for line in inv.lines}
        keep: list[InvoiceLine] = []
        for i, data in enumerate(payload.lines, start=1):
            if data.id is not None:
                line = existing.get(data.id)
                if line is None:
                    raise HTTPException(status_code=400, detail=f"Row {data.id} does not belong to this invoice")
            else:
                line = InvoiceLine(confidence="ok", raw_description=data.raw_description)
            if data.product_id and not db.get(Product, data.product_id):
                raise HTTPException(status_code=400, detail="Material not found")
            if data.product_id != line.product_id:
                line.match_method = "manual" if data.product_id else None
            line.line_no = i
            line.kind = data.kind
            line.quantity = data.quantity
            line.unit = data.unit
            line.unit_price = data.unit_price
            line.product_id = data.product_id
            line.new_name = data.new_name
            line.new_category = data.new_category
            line.new_min = data.new_min
            if data.id is None and data.raw_description is not None:
                line.raw_description = data.raw_description
            if line.quantity is not None and line.unit_price is not None:
                line.net_amount = round(line.quantity * line.unit_price, 2)
            keep.append(line)
        inv.lines = keep


@router.put("/{invoice_id}", response_model=InvoiceOut)
def save_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_writer),
):
    inv = _get(db, invoice_id)
    _apply_update(db, inv, payload)
    db.commit()
    db.refresh(inv)
    return _out(db, inv)


@router.post("/{invoice_id}/reject", response_model=InvoiceOut)
def reject_invoice(invoice_id: int, db: Session = Depends(get_db), _: User = Depends(require_writer)):
    inv = _get(db, invoice_id)
    if inv.status not in EDITABLE_INVOICE_STATUSES:
        raise HTTPException(status_code=400, detail="This invoice is already closed")
    inv.status = "rejected"
    db.commit()
    db.refresh(inv)
    return _out(db, inv)


def _category_id(db: Session, name: Optional[str]) -> Optional[int]:
    name = (name or "").strip()
    if not name:
        return None
    category = db.query(Category).filter(func.lower(Category.name) == name.lower()).first()
    if category is None:
        category = Category(name=name)
        db.add(category)
        db.flush()
    return category.id


def _validate_for_booking(inv: Invoice) -> list[InvoiceLine]:
    """this function runs every check that can refuse an acceptance before anything is
    booked, so a refusal never leaves half an invoice in stock"""
    if not inv.location_id:
        raise HTTPException(status_code=400, detail="Choose the warehouse that receives the materials")
    if not inv.supplier_id:
        raise HTTPException(status_code=400, detail="Choose or create the supplier")
    if inv.currency != HOME_CURRENCY and not inv.exchange_rate:
        raise HTTPException(status_code=400, detail=f"Enter the {inv.currency} to lek exchange rate")
    stock_lines = [line for line in inv.lines if line.kind == "stock"]
    if not stock_lines:
        raise HTTPException(status_code=400, detail="The invoice has no material rows to book")
    for line in stock_lines:
        label = line.raw_description or line.new_name or f"#{line.line_no}"
        if not line.quantity or line.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Row {line.line_no} ({label}): enter the quantity")
        if line.unit_price is not None and line.unit_price < 0:
            raise HTTPException(status_code=400, detail=f"Row {line.line_no} ({label}): price cannot be negative")
        if not line.product_id and not (line.new_name or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"Row {line.line_no} ({label}): pick a material or name the new one",
            )
    return stock_lines


@router.post("/{invoice_id}/accept", response_model=InvoiceOut)
def accept_invoice(
    invoice_id: int,
    payload: InvoiceAccept,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_writer),
):
    inv = _get(db, invoice_id)
    _apply_update(db, inv, payload)
    stock_lines = _validate_for_booking(inv)
    require_location_access(current_user, inv.location_id, "You don't have access to this warehouse")
    if not payload.allow_duplicate and _duplicate_of(db, inv):
        raise HTTPException(
            status_code=409,
            detail=f"Invoice {inv.invoice_number} from this supplier has already been booked",
        )
    _book(db, inv, stock_lines, current_user)

    inv.status = "accepted"
    inv.accepted_by_id = current_user.id
    inv.accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)
    return _out(db, inv)


def _in_lek(inv: Invoice, amount: Optional[float]) -> Optional[float]:
    """this function converts a foreign-currency price to lek before it enters a
    material's average cost, since stock is valued in lek"""
    if amount is None or inv.currency == HOME_CURRENCY:
        return amount
    return round(amount * inv.exchange_rate, 4)


def _book(db: Session, inv: Invoice, stock_lines: list[InvoiceLine], user: User) -> None:
    supplier = db.get(Supplier, inv.supplier_id)
    location = db.get(Location, inv.location_id)
    reference = inv.invoice_number or f"FAT-{inv.id}"
    for line in stock_lines:
        product = db.get(Product, line.product_id) if line.product_id else None
        if product is None:
            product = Product(
                name=line.new_name.strip(), unit=line.unit or "copë", min_stock_level=line.new_min or 0,
                category_id=_category_id(db, line.new_category), supplier_id=supplier.id, quantity=0,
            )
            db.add(product)
            db.flush()
            line.product_id = product.id
            line.match_method = "new"

        apply_purchase_cost(product, line.quantity, _in_lek(inv, line.unit_price))
        product.supplier_id = supplier.id
        record_movement(
            db,
            product_id=product.id,
            movement_type="Purchase Receipt",
            quantity=line.quantity,
            user_id=user.id,
            movement_date=inv.invoice_date or date.today(),
            destination_location_id=location.id,
            invoice_id=inv.id,
            reference_number=reference,
            reason=f"{supplier.name} → {location.name}",
        )
        if line.new_min is not None and line.match_method == "new":
            stock = db.query(ProductStock).filter_by(product_id=product.id, location_id=location.id).first()
            stock.min_quantity = line.new_min
        matching.remember_aliases(db, supplier.id, product.id, line.code, line.raw_description, line.unit)
