"""
this file holds the warehouse permission helpers. everyone signed in can see
stock in every warehouse, but changing stock in a warehouse (receiving an
invoice into it, sending a transfer from it, receiving a transfer into it,
correcting a count) needs a grant in user_location_permissions. admins are
unrestricted
"""
from typing import Optional
from fastapi import HTTPException
from ..models.user import User


def permitted_location_ids(user: User) -> set[int]:
    return {loc.id for loc in user.permitted_locations}


def can_access_location(user: User, location_id: Optional[int]) -> bool:
    if user.role == "admin":
        return True
    if location_id is None:
        return False
    return location_id in permitted_location_ids(user)


def require_location_access(
    user: User,
    location_id: Optional[int],
    detail: str = "You don't have access to this location",
) -> None:
    if not can_access_location(user, location_id):
        raise HTTPException(status_code=403, detail=detail)

