from fastapi import APIRouter, Depends, HTTPException, status, Form, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
from ..database import get_db
from ..models.product import Product
from ..schemas.product import ProductOut, ProductListOut
from ..dependencies import get_current_user, require_admin
from ..models.user import User
from ..services.permissions import permitted_location_ids, scope_query_by_location
import math

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductListOut)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    location_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    status: Optional[str] = None,
    low_stock: Optional[bool] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Product)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if location_id:
        query = query.filter(Product.location_id == location_id)
    if supplier_id:
        query = query.filter(Product.supplier_id == supplier_id)
    if status:
        query = query.filter(Product.status == status)
    if low_stock:
        query = query.filter(Product.quantity <= Product.min_stock_level, Product.min_stock_level > 0)

    # Archived (soft-deleted) products are hidden from normal listings --
    # they still exist for their stock-movement/audit history, but "delete"
    # should make a product disappear from day-to-day use just like a hard
    # delete used to, minus destroying that history.
    if not include_archived:
        query = query.filter(Product.status != "archived")

    # Non-admins only ever see products in warehouses they've been granted
    # access to -- an empty permitted set means an empty product list, not
    # an unfiltered one.
    query = scope_query_by_location(query, Product, current_user)

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return ProductListOut(
        items=[ProductOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    name: str = Form(...),
    sku: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    quantity: float = Form(0),
    unit: str = Form("pcs"),
    min_stock_level: float = Form(0),
    unit_price: Optional[float] = Form(None),
    location_id: Optional[int] = Form(None),
    supplier_id: Optional[int] = Form(None),
    product_status: str = Form("active"),
    notes: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    image_url_2: Optional[str] = Form(None),
    image_url_3: Optional[str] = Form(None),
    price_currency: str = Form("ALL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        if location_id is None:
            raise HTTPException(status_code=400, detail="location_id is required")
        if location_id not in permitted_location_ids(current_user):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to add products to this location",
            )

    product = Product(
        name=name, sku=sku, category_id=category_id, description=description,
        quantity=quantity, unit=unit, min_stock_level=min_stock_level,
        unit_price=unit_price, price_currency=price_currency,
        location_id=location_id, supplier_id=supplier_id,
        status=product_status, notes=notes,
        image_url=image_url, image_url_2=image_url_2, image_url_3=image_url_3,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if current_user.role != "admin" and product.location_id not in permitted_location_ids(current_user):
        raise HTTPException(status_code=403, detail="You don't have access to this product's location")
    return ProductOut.model_validate(product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    name: Optional[str] = Form(None),
    sku: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    unit: Optional[str] = Form(None),
    min_stock_level: Optional[float] = Form(None),
    unit_price: Optional[float] = Form(None),
    location_id: Optional[int] = Form(None),
    supplier_id: Optional[int] = Form(None),
    product_status: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    image_url_2: Optional[str] = Form(None),
    image_url_3: Optional[str] = Form(None),
    price_currency: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Quantity is deliberately not editable here -- once a product exists, its
    quantity only changes through POST /api/stock-movements (Stock In/Out/
    Adjustment), so every change to it has a ledger entry with a reason, a
    user, and a date, instead of a silent overwrite.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if current_user.role != "admin":
        permitted = permitted_location_ids(current_user)
        if product.location_id not in permitted:
            raise HTTPException(status_code=403, detail="You don't have access to this product's location")
        if location_id is not None and location_id not in permitted:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to move products to that location",
            )

    if image_url:
        product.image_url = image_url
    if image_url_2 is not None:
        product.image_url_2 = image_url_2 or None
    if image_url_3 is not None:
        product.image_url_3 = image_url_3 or None

    fields = {
        "name": name, "sku": sku, "category_id": category_id,
        "description": description, "unit": unit,
        "min_stock_level": min_stock_level, "unit_price": unit_price,
        "price_currency": price_currency,
        "location_id": location_id, "supplier_id": supplier_id,
        "status": product_status, "notes": notes,
    }
    for field, value in fields.items():
        if value is not None:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Archives the product rather than deleting the row. A hard delete would
    cascade-destroy its stock-movement history, which an ERP-style audit
    trail needs to survive a product being retired.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = "archived"
    product.archived_at = datetime.now(timezone.utc)
    product.archived_by_id = current_user.id
    db.commit()
