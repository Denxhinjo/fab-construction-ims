from sqlalchemy import Column, Integer, String, Text, Date, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    client = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    status = Column(String(30), default="PLANNED", nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    project_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project_manager = relationship("User", back_populates="managed_projects")
    stock_movements = relationship("StockMovement", back_populates="project")
    work_processes = relationship("WorkProcess", back_populates="project")
