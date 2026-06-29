from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
import math
from ..database import get_db
from ..models.work_process import WorkProcess
from ..schemas.work_process import WorkProcessCreate, WorkProcessUpdate, WorkProcessOut, WorkProcessListOut
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter(prefix="/api/work-processes", tags=["work-processes"])


@router.get("", response_model=WorkProcessListOut)
def list_work_processes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_user_id: Optional[int] = None,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(WorkProcess)
    if search:
        query = query.filter(WorkProcess.title.ilike(f"%{search}%"))
    if status:
        query = query.filter(WorkProcess.status == status)
    if priority:
        query = query.filter(WorkProcess.priority == priority)
    if assigned_user_id:
        query = query.filter(WorkProcess.assigned_user_id == assigned_user_id)
    if location_id:
        query = query.filter(WorkProcess.location_id == location_id)

    query = query.order_by(WorkProcess.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return WorkProcessListOut(
        items=[WorkProcessOut.model_validate(wp) for wp in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=WorkProcessOut, status_code=status.HTTP_201_CREATED)
def create_work_process(
    payload: WorkProcessCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wp = WorkProcess(**payload.model_dump())
    db.add(wp)
    db.commit()
    db.refresh(wp)
    return WorkProcessOut.model_validate(wp)


@router.get("/{wp_id}", response_model=WorkProcessOut)
def get_work_process(
    wp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wp = db.query(WorkProcess).filter(WorkProcess.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail="Work process not found")
    return WorkProcessOut.model_validate(wp)


@router.put("/{wp_id}", response_model=WorkProcessOut)
def update_work_process(
    wp_id: int,
    payload: WorkProcessUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wp = db.query(WorkProcess).filter(WorkProcess.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail="Work process not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wp, field, value)
    db.commit()
    db.refresh(wp)
    return WorkProcessOut.model_validate(wp)


@router.delete("/{wp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_process(
    wp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    wp = db.query(WorkProcess).filter(WorkProcess.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail="Work process not found")
    db.delete(wp)
    db.commit()
