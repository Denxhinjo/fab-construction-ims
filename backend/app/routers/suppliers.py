from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.supplier import Supplier
from ..models.product import Product
from ..schemas.supplier import SupplierCreate, SupplierUpdate, SupplierOut
from ..dependencies import get_current_user, require_admin
from ..models.user import User

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("", response_model=List[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    suppliers = db.query(Supplier).all()
    result = []
    for sup in suppliers:
        out = SupplierOut.model_validate(sup)
        out.product_count = db.query(Product).filter(Product.supplier_id == sup.id).count()
        result.append(out)
    return result


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    sup = Supplier(**payload.model_dump())
    db.add(sup)
    db.commit()
    db.refresh(sup)
    out = SupplierOut.model_validate(sup)
    out.product_count = 0
    return out


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    out = SupplierOut.model_validate(sup)
    out.product_count = db.query(Product).filter(Product.supplier_id == sup.id).count()
    return out


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sup, field, value)
    db.commit()
    db.refresh(sup)
    out = SupplierOut.model_validate(sup)
    out.product_count = db.query(Product).filter(Product.supplier_id == sup.id).count()
    return out


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(sup)
    db.commit()
