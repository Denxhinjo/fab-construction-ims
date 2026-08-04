"""
Central location-permission helpers shared by every router that scopes data
by warehouse access (products, stock movements, work processes, dashboard).

Admins are unrestricted. Everyone else only sees/affects data tied to a
location they've been explicitly granted via user_location_permissions --
a record with no location at all (location_id is None) is only visible to
admins, since there's no permission grant that could cover it.
"""
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Query
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


def scope_query_by_location(query: Query, model, user: User) -> Query:
    """Filters `query` to the caller's permitted locations for non-admins.
    `model` must expose a `location_id` column. Admins get `query` untouched."""
    if user.role == "admin":
        return query
    return query.filter(model.location_id.in_(permitted_location_ids(user)))
