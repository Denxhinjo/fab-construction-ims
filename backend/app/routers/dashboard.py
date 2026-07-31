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

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total_products = db.query(Product).count()
    low_stock_products = db.query(Product).filter(
        Product.quantity <= Product.min_stock_level,
        Product.min_stock_level > 0,
    ).count()
    total_locations = db.query(Location).filter(Location.is_active == True).count()
    active_work_processes = db.query(WorkProcess).filter(
        WorkProcess.status.in_(["Not Started", "Started", "In Process"])
    ).count()
    completed_work_processes = db.query(WorkProcess).filter(
        WorkProcess.status == "Done"
    ).count()
    total_users = db.query(User).filter(User.is_active == True).count()

    total_inventory_value = db.query(
        func.sum(Product.quantity * func.coalesce(Product.unit_price, 0))
    ).scalar() or 0

    # Recent activity (last 7 days)
    seven_days_ago = date.today() - timedelta(days=7)
    recent_movements = (
        db.query(StockMovement)
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
    stock_in_total = db.query(func.sum(StockMovement.quantity)).filter(
        StockMovement.movement_type == "Stock In",
        StockMovement.movement_date >= thirty_days_ago,
    ).scalar() or 0

    stock_out_total = db.query(func.sum(StockMovement.quantity)).filter(
        StockMovement.movement_type == "Stock Out",
        StockMovement.movement_date >= thirty_days_ago,
    ).scalar() or 0

    # Prior 30-day window, so the frontend can show a trend delta rather
    # than a bare total with no point of comparison.
    sixty_days_ago = date.today() - timedelta(days=60)
    stock_in_prev_total = db.query(func.sum(StockMovement.quantity)).filter(
        StockMovement.movement_type == "Stock In",
        StockMovement.movement_date >= sixty_days_ago,
        StockMovement.movement_date < thirty_days_ago,
    ).scalar() or 0

    stock_out_prev_total = db.query(func.sum(StockMovement.quantity)).filter(
        StockMovement.movement_type == "Stock Out",
        StockMovement.movement_date >= sixty_days_ago,
        StockMovement.movement_date < thirty_days_ago,
    ).scalar() or 0

    # Work processes by status
    wp_by_status = {}
    for stat in ["Not Started", "Started", "In Process", "Done"]:
        count = db.query(WorkProcess).filter(WorkProcess.status == stat).count()
        wp_by_status[stat] = count

    # Low stock items list
    low_stock_items = db.query(Product).filter(
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
    }
