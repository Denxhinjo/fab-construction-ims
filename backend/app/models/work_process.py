from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class WorkProcess(Base):
    __tablename__ = "work_processes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    status = Column(String(30), default="Not Started", nullable=False)
    priority = Column(String(20), default="Medium", nullable=False)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completion_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="work_processes")
    assigned_user = relationship("User", back_populates="work_processes", foreign_keys=[assigned_user_id])
    location = relationship("Location", back_populates="work_processes")
