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
from ..models.project import Project
from ..models.warehouse_transfer import WarehouseTransfer
from ..models.purchase_order import PurchaseOrder
from ..dependencies import get_current_user
from ..services.permissions import permitted_location_ids

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_admin = current_user.role in ("admin", "warehouse_manager")
    permitted = permitted_location_ids(current_user)

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
    completed_work_processes = wp_query.filter(WorkProcess.status == "Done").count()
    total_users = db.query(User).filter(User.is_active == True).count()

    total_inventory_value = (
        product_query.with_entities(
            func.sum(Product.quantity * func.coalesce(Product.unit_price, 0))
        ).scalar() or 0
    )

    # New entity counts
    active_projects = db.query(Project).filter(Project.status == "ACTIVE", Project.is_active == True).count()
    pending_transfers = db.query(WarehouseTransfer).filter(
        WarehouseTransfer.status.in_(["PENDING", "APPROVED", "DISPATCHED", "IN_TRANSIT"])
    ).count()
    open_purchase_orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.status.in_(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "PARTIALLY_RECEIVED"])
    ).count()

    def scoped_movements(query):
        if is_admin:
            return query
        return query.join(Product, StockMovement.product_id == Product.id).filter(
            Product.location_id.in_(permitted)
        )

    seven_days_ago = date.today() - timedelta(days=7)
    recent_movements = (
        scoped_movements(db.query(StockMovement))
        .filter(StockMovement.movement_date >= seven_days_ago)
        .order_by(StockMovement.created_at.desc())
        .limit(10)
        .all()
    )

    recent_activity = [
        {
            "id": m.id,
            "type": m.movement_type,
            "product_name": m.product.name if m.product else "Unknown",
            "quantity": m.quantity,
            "unit": m.product.unit if m.product else "",
            "user_name": m.user.full_name if m.user else "Unknown",
            "date": str(m.movement_date),
            "created_at": m.created_at.isoformat(),
        }
        for m in recent_movements
    ]

    thirty_days_ago = date.today() - timedelta(days=30)
    stock_in_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type.in_(["Stock In", "Purchase Receipt", "Opening Balance"]),
        StockMovement.movement_date >= thirty_days_ago,
    ).scalar() or 0

    stock_out_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type.in_(["Stock Out", "Project Issue"]),
        StockMovement.movement_date >= thirty_days_ago,
    ).scalar() or 0

    sixty_days_ago = date.today() - timedelta(days=60)
    stock_in_prev_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type.in_(["Stock In", "Purchase Receipt", "Opening Balance"]),
        StockMovement.movement_date >= sixty_days_ago,
        StockMovement.movement_date < thirty_days_ago,
    ).scalar() or 0

    stock_out_prev_total = scoped_movements(db.query(func.sum(StockMovement.quantity))).filter(
        StockMovement.movement_type.in_(["Stock Out", "Project Issue"]),
        StockMovement.movement_date >= sixty_days_ago,
        StockMovement.movement_date < thirty_days_ago,
    ).scalar() or 0

    top_moved_rows = (
        scoped_movements(
            db.query(StockMovement.product_id, func.sum(StockMovement.quantity).label("total_qty"))
        )
        .filter(StockMovement.movement_date >= thirty_days_ago)
        .group_by(StockMovement.product_id)
        .order_by(func.sum(StockMovement.quantity).desc())
        .limit(5)
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

    week_start = date.today() - timedelta(days=date.today().weekday())
    last_week_start = week_start - timedelta(days=7)
    movements_this_week = scoped_movements(db.query(StockMovement)).filter(
        StockMovement.movement_date >= week_start,
    ).count()
    movements_last_week = scoped_movements(db.query(StockMovement)).filter(
        StockMovement.movement_date >= last_week_start,
        StockMovement.movement_date < week_start,
    ).count()

    wp_by_status = {
        stat: wp_query.filter(WorkProcess.status == stat).count()
        for stat in ["Not Started", "Started", "In Process", "Done"]
    }

    low_stock_items = (
        product_query.filter(Product.quantity <= Product.min_stock_level, Product.min_stock_level > 0)
        .order_by(Product.quantity.asc())
        .limit(5)
        .all()
    )
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
            "active_projects": active_projects,
            "pending_transfers": pending_transfers,
            "open_purchase_orders": open_purchase_orders,
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
