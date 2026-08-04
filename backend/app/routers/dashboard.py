from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from ..database import get_db
from ..models.product import Product
from ..models.location import Location
from ..models.stock_movement import StockMovement
from ..models.work_process import WorkProcess
from ..models.user import User
from ..dependencies import get_current_user
from ..services.permissions import permitted_location_ids

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_admin = current_user.role == "admin"
    permitted = permitted_location_ids(current_user)

    # Every count/sum/list below is scoped to the caller's permitted
    # warehouses for non-admins -- nothing here should leak global totals or
    # activity from a location a regular user hasn't been granted access to.
    # Archived (soft-deleted) products are excluded from every stat here,
    # same as they are from the normal product list.
    product_query = db.query(Product).filter(Product.status != "archived")
    wp_query = db.query(WorkProcess)
    if not is_admin:
        product_query = product_query.filter(Product.location_id.in_(permitted))
        wp_query = wp_query.filter(WorkProcess.location_id.in_(permitted))

    total_products = product_query.count()
    low_stock_products = product_query.filter(
        Product.quantity <= Product.min_stock_level,
        Product.min_stock_level > 0,
    ).count()
    total_locations = (
        db.query(Location).filter(Location.is_active == True).count()
        if is_admin
        else len(permitted)
    )
    active_work_processes = wp_query.filter(
        WorkProcess.status.in_(["Not Started", "Started", "In Process"])
    ).count()
    completed_work_processes = wp_query.filter(
        WorkProcess.status == "Done"
    ).count()
    total_users = db.query(User).filter(User.is_active == True).count()

    total_inventory_value = (
        product_query.with_entities(
            func.sum(Product.quantity * func.coalesce(Product.unit_price, 0))
        ).scalar()
        or 0
    )

    def scoped_movements(query):
        if is_admin:
            return query
        return query.join(Product, StockMovement.product_id == Product.id).filter(
            Product.location_id.in_(permitted)
        )

    # Recent activity (last 7 days)
    seven_days_ago = date.today() - timedelta(days=7)
    recent_movements = (
        scoped_movements(db.query(StockMovement))
        .filter(StockMovement.movement_date >= seven_days_ago)
        .order_by(StockMovement.created_at.desc())
        .limit(10)
        .all()
    )

    recent_activity = []
    for m in recent_movements:
        product_name = m.product.name if m.product else "Unknown"
        user_name = m.user.full_name if m.user else "Unknown"
        recent_activity.append({
            "id": m.id,
            "type": m.movement_type,
            "product_name": product_name,
            "quantity": m.quantity,
            "unit": m.product.unit if m.product else "",
            "user_name": user_name,
            "date": str(m.movement_date),
            "created_at": m.created_at.isoformat(),
        })

    # Stock movement summary for the last 30 days
    thirty_days_ago = date.today() - timedelta(days=30)
    stock_in_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type == "Stock In",
        StockMovement.movement_date >= thirty_days_ago,
    ).scalar() or 0

    stock_out_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type == "Stock Out",
        StockMovement.movement_date >= thirty_days_ago,
    ).scalar() or 0

    # Prior 30-day window, so the frontend can show a trend delta rather
    # than a bare total with no point of comparison.
    sixty_days_ago = date.today() - timedelta(days=60)
    stock_in_prev_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type == "Stock In",
        StockMovement.movement_date >= sixty_days_ago,
        StockMovement.movement_date < thirty_days_ago,
    ).scalar() or 0

    stock_out_prev_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type == "Stock Out",
        StockMovement.movement_date >= sixty_days_ago,
        StockMovement.movement_date < thirty_days_ago,
    ).scalar() or 0

    # Top moved products (last 30 days) -- powers a "top products" bar chart
    top_moved_query = scoped_movements(
        db.query(
            StockMovement.product_id,
            func.sum(StockMovement.quantity).label("total_qty"),
        )
    ).filter(StockMovement.movement_date >= thirty_days_ago)
    top_moved_rows = (
        top_moved_query.group_by(StockMovement.product_id)
        .order_by(func.sum(StockMovement.quantity).desc())
        .limit(3)
        .all()
    )
    top_moved_products = []
    for product_id, total_qty in top_moved_rows:
        product = db.query(Product).filter(Product.id == product_id).first()
        if product:
            top_moved_products.append({
                "id": product.id,
                "name": product.name,
                "quantity": float(total_qty),
                "unit": product.unit,
            })

    # Movement counts this week vs last week, for a weekly-progress style card
    week_start = date.today() - timedelta(days=date.today().weekday())
    last_week_start = week_start - timedelta(days=7)
    movements_this_week = scoped_movements(db.query(StockMovement)).filter(
        StockMovement.movement_date >= week_start,
    ).count()
    movements_last_week = scoped_movements(db.query(StockMovement)).filter(
        StockMovement.movement_date >= last_week_start,
        StockMovement.movement_date < week_start,
    ).count()

    # Work processes by status
    wp_by_status = {}
    for stat in ["Not Started", "Started", "In Process", "Done"]:
        count = wp_query.filter(WorkProcess.status == stat).count()
        wp_by_status[stat] = count

    # Low stock items list
    low_stock_items = product_query.filter(
        Product.quantity <= Product.min_stock_level,
        Product.min_stock_level > 0,
    ).order_by(Product.quantity.asc()).limit(5).all()

    low_stock_list = [
        {
            "id": p.id,
            "name": p.name,
            "quantity": p.quantity,
            "min_stock_level": p.min_stock_level,
            "unit": p.unit,
            "location": p.location.name if p.location else None,
        }
        for p in low_stock_items
    ]

    return {
        "stats": {
            "total_products": total_products,
            "low_stock_products": low_stock_products,
            "total_locations": total_locations,
            "active_work_processes": active_work_processes,
            "completed_work_processes": completed_work_processes,
            "total_users": total_users,
            "total_inventory_value": float(total_inventory_value),
        },
        "stock_summary": {
            "stock_in_30d": float(stock_in_total),
            "stock_out_30d": float(stock_out_total),
            "stock_in_prev_30d": float(stock_in_prev_total),
            "stock_out_prev_30d": float(stock_out_prev_total),
        },
        "work_process_by_status": wp_by_status,
        "recent_activity": recent_activity,
        "low_stock_items": low_stock_list,
        "top_moved_products": top_moved_products,
        "movements_this_week": movements_this_week,
        "movements_last_week": movements_last_week,
    }
