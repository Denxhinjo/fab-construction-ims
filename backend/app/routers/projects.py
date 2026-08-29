from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
import math

from ..database import get_db
from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectListOut
from ..dependencies import get_current_user, require_admin
from ..models.user import User

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=ProjectListOut)
def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Project)
    if search:
        query = query.filter(
            Project.name.ilike(f"%{search}%") | Project.code.ilike(f"%{search}%") | Project.client.ilike(f"%{search}%")
        )
    if status:
        query = query.filter(Project.status == status)
    if is_active is not None:
        query = query.filter(Project.is_active == is_active)

    # Project managers see their own projects; admins and managers see all
    if current_user.role == "project_manager":
        query = query.filter(Project.project_manager_id == current_user.id)

    query = query.order_by(Project.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return ProjectListOut(
        items=[ProjectOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "warehouse_manager", "procurement"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to create projects")
    if db.query(Project).filter(Project.code == payload.code).first():
        raise HTTPException(status_code=400, detail=f"Project code '{payload.code}' already exists")
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role == "project_manager" and project.project_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have access to this project")
    return ProjectOut.model_validate(project)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role not in ("admin", "warehouse_manager", "procurement", "project_manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role == "project_manager" and project.project_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own projects")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "code" and value:
            existing = db.query(Project).filter(Project.code == value, Project.id != project_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Project code '{value}' already exists")
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.is_active = False
    db.commit()
