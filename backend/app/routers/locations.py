from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.location import Location
from ..models.product import Product
from ..schemas.location import LocationCreate, LocationUpdate, LocationOut
from ..dependencies import get_current_user, require_admin
from ..models.user import User

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=List[LocationOut])
def list_locations(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    locations = db.query(Location).all()
    result = []
    for loc in locations:
        out = LocationOut.model_validate(loc)
        out.product_count = db.query(Product).filter(Product.location_id == loc.id).count()
        result.append(out)
    return result


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    loc = Location(**payload.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    out = LocationOut.model_validate(loc)
    out.product_count = 0
    return out


@router.get("/{location_id}", response_model=LocationOut)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    out = LocationOut.model_validate(loc)
    out.product_count = db.query(Product).filter(Product.location_id == loc.id).count()
    return out


@router.put("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    out = LocationOut.model_validate(loc)
    out.product_count = db.query(Product).filter(Product.location_id == loc.id).count()
    return out


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    if db.query(Product).filter(Product.location_id == location_id).count() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete location with existing products")
    db.delete(loc)
    db.commit()
