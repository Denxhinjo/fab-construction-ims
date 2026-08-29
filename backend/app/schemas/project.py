from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from .user import UserSummary

PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]


class ProjectBase(BaseModel):
    code: str
    name: str
    client: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    status: str = "PLANNED"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    project_manager_id: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in PROJECT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(PROJECT_STATUSES)}")
        return v


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    client: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    project_manager_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectSummary(BaseModel):
    id: int
    code: str
    name: str
    status: str

    model_config = {"from_attributes": True}


class ProjectOut(ProjectBase):
    id: int
    is_active: bool
    project_manager: Optional[UserSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListOut(BaseModel):
    items: list[ProjectOut]
    total: int
    page: int
    page_size: int
    total_pages: int
