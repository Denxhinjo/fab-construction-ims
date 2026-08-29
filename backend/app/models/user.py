from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base
from .user_location_permission import user_location_permissions


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"
    procurement = "procurement"
    warehouse_manager = "warehouse_manager"
    warehouse_worker = "warehouse_worker"
    project_manager = "project_manager"
    finance = "finance"
    viewer = "viewer"

VALID_ROLES = {r.value for r in UserRole}

ADMIN_ROLES = {"admin"}
MANAGER_ROLES = {"admin", "warehouse_manager"}
PROCUREMENT_ROLES = {"admin", "procurement"}
WORKER_ROLES = {"admin", "warehouse_manager", "warehouse_worker", "procurement"}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stock_movements = relationship("StockMovement", foreign_keys="StockMovement.user_id", back_populates="user", lazy="dynamic")
    work_processes = relationship("WorkProcess", back_populates="assigned_user", foreign_keys="WorkProcess.assigned_user_id", lazy="dynamic")
    managed_projects = relationship("Project", back_populates="project_manager")
    permitted_locations = relationship(
        "Location", secondary=user_location_permissions, back_populates="permitted_users"
    )
