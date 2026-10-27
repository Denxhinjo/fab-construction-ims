from sqlalchemy import Table, Column, Integer, ForeignKey
from ..database import Base

#this table links non-admin users to the warehouses they may create or edit products in.
#admins are unrestricted whatever this table holds (checked in code, not modelled here)
user_location_permissions = Table(
    "user_location_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("location_id", Integer, ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True),
)
