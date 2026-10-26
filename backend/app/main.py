from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import (
    auth, users, categories, locations, suppliers, products,
    stock_movements, dashboard, transfers, invoices,
)

app = FastAPI(
    title="Fab Construction IMS API",
    description="Inventory Management System for Fab Construction",
    version="3.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(locations.router)
app.include_router(suppliers.router)
app.include_router(products.router)
app.include_router(products.stock_router)
app.include_router(stock_movements.router)
app.include_router(dashboard.router)
app.include_router(transfers.router)
app.include_router(invoices.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Fab Construction IMS", "version": "3.0.0"}
