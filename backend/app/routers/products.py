from fastapi import APIRouter, Depends, HTTPException, status, Form, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models.product import Product
from ..schemas.product import ProductOut, ProductListOut
from ..dependencies import get_current_user, require_admin
from ..models.user import User
import math

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductListOut)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    location_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    status: Optional[str] = None,
    low_stock: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = Product(
        name=name, sku=sku, category_id=category_id, description=description,
        quantity=quantity, unit=unit, min_stock_level=min_stock_level,
        unit_price=unit_price, location_id=location_id, supplier_id=supplier_id,
        status=product_status, notes=notes, image_url=image_url,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return ProductOut.model_validate(product)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductOut.model_validate(product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    name: Optional[str] = Form(None),
    sku: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    quantity: Optional[float] = Form(None),
    unit: Optional[str] = Form(None),
    min_stock_level: Optional[float] = Form(None),
    unit_price: Optional[float] = Form(None),
    location_id: Optional[int] = Form(None),
    supplier_id: Optional[int] = Form(None),
    product_status: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if image_url:
        product.image_url = image_url

    fields = {
        "name": name, "sku": sku, "category_id": category_id,
        "description": description, "quantity": quantity, "unit": unit,
        "min_stock_level": min_stock_level, "unit_price": unit_price,
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
    _: User = Depends(require_admin),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
