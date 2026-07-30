from sqlalchemy import Table, Column, Integer, ForeignKey
from ..database import Base

# Many-to-many: which warehouses/locations a non-admin user is allowed to
# create or edit products in. Admins are unrestricted regardless of this
# table's contents (checked in code, not modeled here).
user_location_permissions = Table(
    "user_location_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("location_id", Integer, ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True),
)
