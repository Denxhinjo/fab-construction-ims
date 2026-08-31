from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.product import Product
from ..models.user import User
from ..dependencies import get_current_user
from ..services.email_service import send_low_stock_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

ALERT_ROLES = {"admin", "warehouse_manager"}


@router.post("/low-stock")
def trigger_low_stock_alert(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ALERT_ROLES:
        raise HTTPException(status_code=403, detail="Admin or warehouse manager required")

    low = (
        db.query(Product)
        .filter(
            Product.status != "archived",
            Product.min_stock_level > 0,
            Product.quantity <= Product.min_stock_level,
        )
        .all()
    )

    if not low:
        return {"sent": False, "count": 0, "message": "No low-stock products found"}

    products = [
        {
            "name": p.name,
            "quantity": p.quantity,
            "unit": p.unit,
            "min_stock_level": p.min_stock_level,
            "location": p.location.name if p.location else None,
        }
        for p in low
    ]

    sent = send_low_stock_alert(products)
    return {
        "sent": sent,
        "count": len(products),
        "message": "Alert sent" if sent else "SMTP not configured — alert not sent",
    }


@router.get("/low-stock/preview")
def preview_low_stock(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return low-stock products without sending an email (for the dashboard count)."""
    if current_user.role not in ALERT_ROLES:
        raise HTTPException(status_code=403, detail="Admin or warehouse manager required")

    low = (
        db.query(Product)
        .filter(
            Product.status != "archived",
            Product.min_stock_level > 0,
            Product.quantity <= Product.min_stock_level,
        )
        .all()
    )
    return {
        "count": len(low),
        "products": [
            {"id": p.id, "name": p.name, "quantity": p.quantity, "unit": p.unit,
             "min_stock_level": p.min_stock_level, "location": p.location.name if p.location else None}
            for p in low
        ],
    }
