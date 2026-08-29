import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import settings
from .routers import (
    auth, users, categories, locations, suppliers, products,
    stock_movements, work_processes, dashboard, uploads,
    projects, transfers, purchase_orders,
)

app = FastAPI(
    title="Fab Construction IMS API",
    description="Inventory Management System for Fab Construction",
    version="2.0.0",
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

# Mount static files for uploaded media
media_dir = settings.MEDIA_DIR
os.makedirs(media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_dir), name="media")

# Core
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(locations.router)
app.include_router(suppliers.router)
app.include_router(products.router)
app.include_router(stock_movements.router)
app.include_router(work_processes.router)
app.include_router(dashboard.router)
app.include_router(uploads.router)
# Phase 2 — Procurement & Projects
app.include_router(projects.router)
app.include_router(transfers.router)
app.include_router(purchase_orders.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Fab Construction IMS", "version": "2.0.0"}
