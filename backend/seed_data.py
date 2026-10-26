"""
Seed demo/dev data for Fab Construction IMS.

Only populates a brand-new database: if any user exists it does nothing,
so it is safe in a start command. Run it yourself for a dev database:

    docker compose exec backend python seed_data.py
"""
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext

from app.database import SessionLocal
from app.models import Category, Location, Product, ProductStock, Supplier, User
from app.services.inventory_service import record_movement

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEPOTS = ["Depo Qendrore", "Depo Veri", "Depo Jug"]

SUPPLIERS = [
    ("Beton-Mix SH.P.K.", "K12345678L"),
    ("Metal-Kos SH.P.K.", "K11223344M"),
    ("Ndërtimi Plus", "L23456789N"),
    ("Hidro-Tek", "L34567890P"),
    ("Gurorja Krujë", "K45678901R"),
]

# name, sku, category, unit, avg cost (Lekë, pa TVSH), supplier,
# (qty, min) per depot in DEPOTS order
MATERIALS = [
    ("Çimento CEM II 42.5R, 25 kg", "CEM-425-25", "Lidhës", "thes", 640, 0, [(820, 200), (140, 100), (95, 50)]),
    ("Hekur armature Ø12, 12 m", "HEK-012-12", "Hekur", "shufër", 1490, 1, [(340, 100), (18, 50), (72, 40)]),
    ("Hekur armature Ø8, 12 m", "HEK-008-12", "Hekur", "shufër", 670, 1, [(510, 100), (120, 50), (86, 40)]),
    ("Rrjetë armature Q188", "RRJ-Q188", "Hekur", "copë", 3800, 1, [(45, 10), (6, 20), (22, 10)]),
    ("Blloqe betoni 20 cm", "BLL-200", "Mure", "copë", 85, 0, [(2400, 500), (900, 500), (650, 300)]),
    ("Gips-karton 12.5 mm", "GPS-125", "Gips", "pllakë", 520, 2, [(210, 50), (60, 30), (120, 30)]),
    ("Llaç ngjitës C1, 25 kg", "LLC-C1-25", "Lidhës", "thes", 710, 0, [(180, 40), (40, 20), (55, 20)]),
    ("Tub PVC Ø110, 3 m", "PVC-110-3", "Hidraulikë", "copë", 980, 3, [(64, 20), (35, 15), (12, 30)]),
    ("Rërë lumi", "AGR-RER", "Agregate", "m³", 2200, 4, [(4, 10), (0, None), (7, 5)]),
    ("Zhavorr 16–32 mm", "AGR-ZHV", "Agregate", "m³", 1850, 4, [(26, 10), (12, 5), (9, 5)]),
]


def seed():
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded -- skipping.")
            return

        admin = User(
            email="admin@fabconstruction.com", username="admin", full_name="System Administrator",
            hashed_password=pwd_context.hash("Admin@123"), role="admin", is_active=True,
        )
        db.add_all([
            admin,
            User(
                email="arkfabconstruction@gmail.com", username="arkfab", full_name="Ark Fab Construction",
                hashed_password=pwd_context.hash("Fabconstruction2026"), role="warehouse_manager", is_active=True,
            ),
            User(
                email="dxhabrahimi2002@gmail.com", username="denxhinjo", full_name="Denxhinjo Abrahimi",
                hashed_password=pwd_context.hash("Denis@123"), role="admin", is_active=True,
            ),
        ])
        depots = [Location(name=name, city="Tiranë") for name in DEPOTS]
        db.add_all(depots)
        suppliers = [Supplier(name=name, tax_number=nipt) for name, nipt in SUPPLIERS]
        db.add_all(suppliers)
        db.flush()

        categories: dict[str, Category] = {}
        for name, sku, category, unit, cost, supplier_i, per_depot in MATERIALS:
            if category not in categories:
                categories[category] = Category(name=category)
                db.add(categories[category])
                db.flush()
            product = Product(
                name=name, sku=sku, category_id=categories[category].id, unit=unit, quantity=0,
                avg_cost=cost, latest_cost=cost, supplier_id=suppliers[supplier_i].id,
            )
            db.add(product)
            db.flush()
            for depot, (qty, minimum) in zip(depots, per_depot):
                if qty:
                    record_movement(
                        db, product_id=product.id, movement_type="Opening Balance", quantity=qty,
                        user_id=admin.id, movement_date=date.today(), destination_location_id=depot.id,
                        reason="Gjendja fillestare",
                    )
                if minimum is not None:
                    stock = db.query(ProductStock).filter_by(product_id=product.id, location_id=depot.id).first()
                    if stock is None:
                        stock = ProductStock(product_id=product.id, location_id=depot.id, quantity=0)
                        db.add(stock)
                    stock.min_quantity = minimum

        db.commit()
        print("✓ Seed data complete")
        print("  Admin:             admin / Admin@123")
        print("  Warehouse manager: arkfab / Fabconstruction2026")
        print("  Admin:             denxhinjo / Denis@123")
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
