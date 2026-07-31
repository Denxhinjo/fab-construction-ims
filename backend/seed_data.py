"""
Seed demo data for Fab Construction IMS.
Run: python seed_data.py
"""
import sys
import os
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import User, Location, Category, Supplier, Product, StockMovement, WorkProcess
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # This script runs on every container start, but it's only meant to
        # populate a brand-new database. Once real usage has modified the
        # data (e.g. products/movements deleted through the app), later
        # sections here can no longer assume the original demo indices/counts
        # line up, so skip entirely rather than seed a partial, mismatched
        # dataset on top of a live database.
        if db.query(User).count() > 0:
            print("Database already seeded -- skipping.")
            return

        # Users
        if db.query(User).count() == 0:
            users = [
                User(
                    email="admin@fabconstruction.com",
                    username="admin",
                    full_name="System Administrator",
                    hashed_password=pwd_context.hash("Admin@123"),
                    role="admin",
                    is_active=True,
                    phone="+1-555-0100",
                ),
                User(
                    email="john.smith@fabconstruction.com",
                    username="jsmith",
                    full_name="John Smith",
                    hashed_password=pwd_context.hash("User@123"),
                    role="user",
                    is_active=True,
                    phone="+1-555-0101",
                ),
                User(
                    email="sarah.jones@fabconstruction.com",
                    username="sjones",
                    full_name="Sarah Jones",
                    hashed_password=pwd_context.hash("User@123"),
                    role="user",
                    is_active=True,
                    phone="+1-555-0102",
                ),
                User(
                    email="mike.wilson@fabconstruction.com",
                    username="mwilson",
                    full_name="Mike Wilson",
                    hashed_password=pwd_context.hash("User@123"),
                    role="user",
                    is_active=True,
                    phone="+1-555-0103",
                ),
            ]
            db.add_all(users)
            db.commit()
            print("✓ Users seeded")

        # Locations
        if db.query(Location).count() == 0:
            locations = [
                Location(
                    name="Main Warehouse",
                    address="1234 Industrial Blvd",
                    city="Houston",
                    manager_name="Robert Torres",
                    contact_email="warehouse@fabconstruction.com",
                    contact_phone="+1-555-0200",
                    notes="Primary storage facility for all construction materials",
                ),
                Location(
                    name="Downtown Site",
                    address="567 Commerce St",
                    city="Houston",
                    manager_name="Linda Carter",
                    contact_email="downtown@fabconstruction.com",
                    contact_phone="+1-555-0201",
                    notes="Active construction site - downtown high-rise project",
                ),
                Location(
                    name="North Branch",
                    address="890 Highway 45 North",
                    city="The Woodlands",
                    manager_name="David Kim",
                    contact_email="north@fabconstruction.com",
                    contact_phone="+1-555-0202",
                    notes="Secondary warehouse for northern projects",
                ),
                Location(
                    name="South Yard",
                    address="321 Port Access Rd",
                    city="Pasadena",
                    manager_name="Maria Santos",
                    contact_email="south@fabconstruction.com",
                    contact_phone="+1-555-0203",
                    notes="Outdoor storage for heavy equipment and bulk materials",
                ),
            ]
            db.add_all(locations)
            db.commit()
            print("✓ Locations seeded")

        # Categories
        if db.query(Category).count() == 0:
            categories = [
                Category(name="Structural Steel", description="Steel beams, columns, and frames", color="#EF4444"),
                Category(name="Concrete & Masonry", description="Cement, blocks, and bricks", color="#6B7280"),
                Category(name="Electrical", description="Wiring, panels, and fixtures", color="#F59E0B"),
                Category(name="Plumbing", description="Pipes, fittings, and valves", color="#3B82F6"),
                Category(name="Safety Equipment", description="PPE and safety gear", color="#10B981"),
                Category(name="Tools & Equipment", description="Hand tools and power tools", color="#8B5CF6"),
                Category(name="Lumber & Wood", description="Timber, plywood, and wood products", color="#D97706"),
                Category(name="Finishing Materials", description="Paint, flooring, and tiles", color="#EC4899"),
            ]
            db.add_all(categories)
            db.commit()
            print("✓ Categories seeded")

        # Suppliers
        if db.query(Supplier).count() == 0:
            suppliers = [
                Supplier(
                    name="Gulf Coast Steel Supply",
                    contact_name="Tom Bradley",
                    email="sales@gulfcoaststeel.com",
                    phone="+1-555-0300",
                    address="5000 Ship Channel Blvd",
                    city="Houston",
                ),
                Supplier(
                    name="Texas Ready-Mix Concrete",
                    contact_name="Carlos Rivera",
                    email="orders@texasreadymix.com",
                    phone="+1-555-0301",
                    address="2200 Concrete Way",
                    city="Katy",
                ),
                Supplier(
                    name="Lone Star Electrical",
                    contact_name="Pam Hughes",
                    email="supply@lonestare.com",
                    phone="+1-555-0302",
                    address="740 Electra Drive",
                    city="Houston",
                ),
                Supplier(
                    name="Houston Pipe & Supply",
                    contact_name="Gary Fields",
                    email="info@houstonpipe.com",
                    phone="+1-555-0303",
                    address="1100 Industrial Loop",
                    city="Houston",
                ),
                Supplier(
                    name="SafeGuard Pro",
                    contact_name="Nancy White",
                    email="orders@safeguardpro.com",
                    phone="+1-555-0304",
                    address="330 Safety Blvd",
                    city="Sugar Land",
                ),
            ]
            db.add_all(suppliers)
            db.commit()
            print("✓ Suppliers seeded")

        # Products
        if db.query(Product).count() == 0:
            cats = {c.name: c for c in db.query(Category).all()}
            locs = {l.name: l for l in db.query(Location).all()}
            sups = {s.name: s for s in db.query(Supplier).all()}

            products = [
                Product(name="W8x31 Steel Beam", sku="STL-001", category_id=cats["Structural Steel"].id,
                        description="Wide flange steel beam 8 inch x 31 lb/ft", quantity=45, unit="pcs",
                        min_stock_level=10, unit_price=185.00, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["Gulf Coast Steel Supply"].id, status="active"),
                Product(name="HSS 6x4 Rectangular Tube", sku="STL-002", category_id=cats["Structural Steel"].id,
                        description="Hollow structural section 6x4 inch", quantity=8, unit="pcs",
                        min_stock_level=15, unit_price=95.00, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["Gulf Coast Steel Supply"].id, status="active"),
                Product(name="Portland Cement Type I", sku="CON-001", category_id=cats["Concrete & Masonry"].id,
                        description="94 lb bag of Portland cement", quantity=320, unit="bags",
                        min_stock_level=100, unit_price=12.50, location_id=locs["South Yard"].id,
                        supplier_id=sups["Texas Ready-Mix Concrete"].id, status="active"),
                Product(name="Concrete Block 8x8x16", sku="CON-002", category_id=cats["Concrete & Masonry"].id,
                        description="Standard CMU block", quantity=1500, unit="pcs",
                        min_stock_level=500, unit_price=2.10, location_id=locs["South Yard"].id,
                        supplier_id=sups["Texas Ready-Mix Concrete"].id, status="active"),
                Product(name="12/2 NM-B Wire (250ft)", sku="ELE-001", category_id=cats["Electrical"].id,
                        description="12 gauge 2-conductor Romex wire", quantity=40, unit="rolls",
                        min_stock_level=20, unit_price=78.00, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["Lone Star Electrical"].id, status="active"),
                Product(name="200A Main Panel", sku="ELE-002", category_id=cats["Electrical"].id,
                        description="200 amp residential main breaker panel", quantity=5, unit="pcs",
                        min_stock_level=3, unit_price=320.00, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["Lone Star Electrical"].id, status="active"),
                Product(name="4 inch PVC Pipe (10ft)", sku="PLM-001", category_id=cats["Plumbing"].id,
                        description="Schedule 40 PVC drain pipe", quantity=80, unit="pcs",
                        min_stock_level=30, unit_price=18.50, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["Houston Pipe & Supply"].id, status="active"),
                Product(name="Hard Hat (ANSI Class E)", sku="SAF-001", category_id=cats["Safety Equipment"].id,
                        description="Construction safety hard hat, assorted colors", quantity=25, unit="pcs",
                        min_stock_level=10, unit_price=22.00, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["SafeGuard Pro"].id, status="active"),
                Product(name="Safety Vest Hi-Vis Orange", sku="SAF-002", category_id=cats["Safety Equipment"].id,
                        description="ANSI class 2 high-visibility safety vest", quantity=30, unit="pcs",
                        min_stock_level=15, unit_price=14.00, location_id=locs["Main Warehouse"].id,
                        supplier_id=sups["SafeGuard Pro"].id, status="active"),
                Product(name="2x4 Lumber (8ft)", sku="LUM-001", category_id=cats["Lumber & Wood"].id,
                        description="Douglas Fir 2x4 dimensional lumber", quantity=200, unit="pcs",
                        min_stock_level=50, unit_price=8.50, location_id=locs["South Yard"].id,
                        status="active"),
                Product(name="3/4 inch Plywood Sheet", sku="LUM-002", category_id=cats["Lumber & Wood"].id,
                        description="4x8 CDX plywood sheet", quantity=60, unit="sheets",
                        min_stock_level=25, unit_price=52.00, location_id=locs["Main Warehouse"].id,
                        status="active"),
                Product(name="Angle Grinder 4.5 inch", sku="TLS-001", category_id=cats["Tools & Equipment"].id,
                        description="Corded angle grinder with disc", quantity=8, unit="pcs",
                        min_stock_level=3, unit_price=65.00, location_id=locs["Main Warehouse"].id,
                        status="active"),
                Product(name="Cordless Drill 20V", sku="TLS-002", category_id=cats["Tools & Equipment"].id,
                        description="20V max cordless drill/driver kit", quantity=3, unit="pcs",
                        min_stock_level=5, unit_price=129.00, location_id=locs["Main Warehouse"].id,
                        status="active"),
                Product(name="Exterior Paint - White 5gal", sku="FIN-001", category_id=cats["Finishing Materials"].id,
                        description="Premium exterior latex paint, white base", quantity=20, unit="buckets",
                        min_stock_level=10, unit_price=68.00, location_id=locs["North Branch"].id,
                        status="active"),
                Product(name="Ceramic Floor Tile 12x12", sku="FIN-002", category_id=cats["Finishing Materials"].id,
                        description="Porcelain ceramic floor tile, case of 10 sq ft", quantity=150, unit="cases",
                        min_stock_level=40, unit_price=32.00, location_id=locs["North Branch"].id,
                        status="active"),
            ]
            db.add_all(products)
            db.commit()
            print("✓ Products seeded")

        # Stock Movements
        if db.query(StockMovement).count() == 0:
            admin = db.query(User).filter(User.role == "admin").first()
            user1 = db.query(User).filter(User.username == "jsmith").first()
            products = db.query(Product).all()
            today = date.today()

            movements = [
                StockMovement(product_id=products[0].id, movement_type="Stock In",
                              quantity=20, previous_quantity=25, new_quantity=45,
                              reason="Monthly restocking", user_id=admin.id,
                              movement_date=today - timedelta(days=3), notes="Order #PO-2024-001"),
                StockMovement(product_id=products[2].id, movement_type="Stock Out",
                              quantity=50, previous_quantity=370, new_quantity=320,
                              reason="Downtown site delivery", user_id=user1.id,
                              movement_date=today - timedelta(days=2)),
                StockMovement(product_id=products[4].id, movement_type="Stock In",
                              quantity=15, previous_quantity=25, new_quantity=40,
                              reason="Weekly restock", user_id=admin.id,
                              movement_date=today - timedelta(days=1)),
                StockMovement(product_id=products[6].id, movement_type="Stock Out",
                              quantity=10, previous_quantity=90, new_quantity=80,
                              reason="Plumbing work - north site", user_id=user1.id,
                              movement_date=today),
                StockMovement(product_id=products[12].id, movement_type="Adjustment",
                              quantity=3, previous_quantity=6, new_quantity=3,
                              reason="Inventory audit correction", user_id=admin.id,
                              movement_date=today - timedelta(days=5)),
                StockMovement(product_id=products[9].id, movement_type="Stock In",
                              quantity=100, previous_quantity=100, new_quantity=200,
                              reason="Lumber delivery from supplier", user_id=admin.id,
                              movement_date=today - timedelta(days=7)),
                StockMovement(product_id=products[7].id, movement_type="Stock Out",
                              quantity=5, previous_quantity=30, new_quantity=25,
                              reason="New worker onboarding - safety gear", user_id=user1.id,
                              movement_date=today - timedelta(days=1)),
            ]
            db.add_all(movements)
            db.commit()
            print("✓ Stock movements seeded")

        # Work Processes
        if db.query(WorkProcess).count() == 0:
            users = db.query(User).all()
            locs = {l.name: l for l in db.query(Location).all()}
            prods = {p.sku: p for p in db.query(Product).all()}
            today = date.today()

            work_processes = [
                WorkProcess(
                    title="Steel Frame Erection - Floor 5-8",
                    description="Erect structural steel frames for floors 5 through 8 of the downtown project",
                    product_id=prods["STL-001"].id,
                    assigned_user_id=users[1].id,
                    location_id=locs["Downtown Site"].id,
                    status="In Process",
                    priority="High",
                    start_date=today - timedelta(days=5),
                    due_date=today + timedelta(days=10),
                    notes="Crane scheduled for days 3-7",
                ),
                WorkProcess(
                    title="Foundation Concrete Pour - Block B",
                    description="Pour foundation slab for Building Block B",
                    product_id=prods["CON-001"].id,
                    assigned_user_id=users[2].id,
                    location_id=locs["Downtown Site"].id,
                    status="Not Started",
                    priority="Critical",
                    start_date=today + timedelta(days=2),
                    due_date=today + timedelta(days=4),
                    notes="Requires weather window of 3 consecutive dry days",
                ),
                WorkProcess(
                    title="Electrical Rough-In - Building A Units 101-110",
                    description="Install electrical rough-in wiring for first floor units",
                    product_id=prods["ELE-001"].id,
                    assigned_user_id=users[3].id,
                    location_id=locs["Downtown Site"].id,
                    status="Started",
                    priority="Medium",
                    start_date=today - timedelta(days=2),
                    due_date=today + timedelta(days=5),
                ),
                WorkProcess(
                    title="Plumbing Installation - North Wing",
                    description="Install all drainage and supply plumbing for north wing",
                    product_id=prods["PLM-001"].id,
                    assigned_user_id=users[1].id,
                    location_id=locs["North Branch"].id,
                    status="Not Started",
                    priority="Medium",
                    start_date=today + timedelta(days=7),
                    due_date=today + timedelta(days=20),
                ),
                WorkProcess(
                    title="Main Warehouse Safety Audit",
                    description="Conduct full safety audit of main warehouse storage areas",
                    assigned_user_id=users[0].id,
                    location_id=locs["Main Warehouse"].id,
                    status="Done",
                    priority="High",
                    start_date=today - timedelta(days=14),
                    due_date=today - timedelta(days=10),
                    completion_date=today - timedelta(days=10),
                    notes="All items passed. Next audit in 90 days.",
                ),
                WorkProcess(
                    title="Floor Tiling - Community Areas",
                    description="Install ceramic floor tiles in all community/common areas",
                    product_id=prods["FIN-002"].id,
                    assigned_user_id=users[2].id,
                    location_id=locs["Downtown Site"].id,
                    status="Not Started",
                    priority="Low",
                    start_date=today + timedelta(days=30),
                    due_date=today + timedelta(days=45),
                ),
                WorkProcess(
                    title="Inventory Count - South Yard",
                    description="Full physical inventory count of South Yard storage",
                    assigned_user_id=users[3].id,
                    location_id=locs["South Yard"].id,
                    status="Done",
                    priority="Medium",
                    start_date=today - timedelta(days=7),
                    due_date=today - timedelta(days=6),
                    completion_date=today - timedelta(days=6),
                    notes="Discrepancy found in concrete blocks, adjustment submitted",
                ),
            ]
            db.add_all(work_processes)
            db.commit()
            print("✓ Work processes seeded")

        print("\n✅ Seed data complete!")
        print("\nDemo accounts:")
        print("  Admin: admin@fabconstruction.com / Admin@123")
        print("  User:  john.smith@fabconstruction.com / User@123")
        print("  User:  sarah.jones@fabconstruction.com / User@123")
        print("  User:  mike.wilson@fabconstruction.com / User@123")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
