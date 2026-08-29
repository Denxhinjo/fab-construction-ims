"""Phase 2 expansion: projects, transfers, purchase orders, product stock, audit log

Revision ID: 3a8f2c10d4e5
Revises: 1f740fff8426
Create Date: 2026-08-29

"""
from alembic import op
import sqlalchemy as sa

revision = "3a8f2c10d4e5"
down_revision = "1f740fff8426"
branch_labels = None
depends_on = None


def upgrade():
    # ── projects ────────────────────────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("client", sa.String(255), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="PLANNED"),
        sa.Column("start_date", sa.Date, nullable=True),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("project_manager_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_project_code"),
    )
    op.create_index("ix_projects_code", "projects", ["code"], unique=True)

    # ── warehouse_transfers ──────────────────────────────────────────────────────
    op.create_table(
        "warehouse_transfers",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("reference", sa.String(50), nullable=False),
        sa.Column("source_location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("destination_location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("requested_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("dispatched_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("received_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("reference", name="uq_transfer_reference"),
    )
    op.create_index("ix_warehouse_transfers_reference", "warehouse_transfers", ["reference"], unique=True)

    # ── warehouse_transfer_items ─────────────────────────────────────────────────
    op.create_table(
        "warehouse_transfer_items",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("transfer_id", sa.Integer, sa.ForeignKey("warehouse_transfers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id"), nullable=False),
        sa.Column("quantity", sa.Float, nullable=False),
        sa.Column("received_quantity", sa.Float, nullable=False, server_default="0"),
        sa.Column("notes", sa.String(500), nullable=True),
    )

    # ── purchase_orders ──────────────────────────────────────────────────────────
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("po_number", sa.String(50), nullable=False),
        sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("destination_location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT"),
        sa.Column("order_date", sa.Date, nullable=False),
        sa.Column("expected_delivery_date", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("total_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="ALL"),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("po_number", name="uq_po_number"),
    )
    op.create_index("ix_purchase_orders_po_number", "purchase_orders", ["po_number"], unique=True)

    # ── purchase_order_items ─────────────────────────────────────────────────────
    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("purchase_order_id", sa.Integer, sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id"), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("quantity", sa.Float, nullable=False),
        sa.Column("received_quantity", sa.Float, nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Float, nullable=True),
        sa.Column("unit", sa.String(50), nullable=False, server_default="pcs"),
    )

    # ── product_stock ────────────────────────────────────────────────────────────
    op.create_table(
        "product_stock",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Float, nullable=False, server_default="0"),
        sa.Column("reserved_quantity", sa.Float, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("product_id", "location_id", name="uq_product_location"),
    )

    # ── audit_log ────────────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.Integer, nullable=True),
        sa.Column("changes", sa.Text, nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    # ── alter stock_movements: add new context columns ───────────────────────────
    op.alter_column("stock_movements", "movement_type", type_=sa.String(50), existing_nullable=False)
    op.add_column("stock_movements", sa.Column("source_location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=True))
    op.add_column("stock_movements", sa.Column("destination_location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=True))
    op.add_column("stock_movements", sa.Column("project_id", sa.Integer, sa.ForeignKey("projects.id"), nullable=True))
    op.add_column("stock_movements", sa.Column("purchase_order_id", sa.Integer, sa.ForeignKey("purchase_orders.id"), nullable=True))
    op.add_column("stock_movements", sa.Column("transfer_id", sa.Integer, sa.ForeignKey("warehouse_transfers.id"), nullable=True))
    op.add_column("stock_movements", sa.Column("approved_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))
    op.add_column("stock_movements", sa.Column("received_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))

    # ── alter products: add new fields ───────────────────────────────────────────
    op.add_column("products", sa.Column("brand", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("barcode", sa.String(100), nullable=True))
    op.add_column("products", sa.Column("reorder_quantity", sa.Float, nullable=True))
    op.add_column("products", sa.Column("latest_cost", sa.Float, nullable=True))
    op.add_column("products", sa.Column("avg_cost", sa.Float, nullable=True))
    op.create_index("ix_products_barcode", "products", ["barcode"])

    # ── alter suppliers: add new fields ─────────────────────────────────────────
    op.add_column("suppliers", sa.Column("tax_number", sa.String(50), nullable=True))
    op.add_column("suppliers", sa.Column("payment_terms", sa.String(100), nullable=True))
    op.add_column("suppliers", sa.Column("lead_time_days", sa.Integer, nullable=True))

    # ── alter users: widen role column for new role values ───────────────────────
    op.alter_column("users", "role", type_=sa.String(30), existing_nullable=False)

    # ── seed product_stock from existing products ────────────────────────────────
    op.execute(
        """
        INSERT INTO product_stock (product_id, location_id, quantity, reserved_quantity)
        SELECT id, location_id, quantity, 0
        FROM products
        WHERE location_id IS NOT NULL
          AND status != 'archived'
        ON CONFLICT (product_id, location_id) DO NOTHING
        """
    )


def downgrade():
    op.drop_index("ix_products_barcode", "products")
    op.drop_column("products", "avg_cost")
    op.drop_column("products", "latest_cost")
    op.drop_column("products", "reorder_quantity")
    op.drop_column("products", "barcode")
    op.drop_column("products", "brand")

    op.drop_column("suppliers", "lead_time_days")
    op.drop_column("suppliers", "payment_terms")
    op.drop_column("suppliers", "tax_number")

    op.drop_column("stock_movements", "received_by_id")
    op.drop_column("stock_movements", "approved_by_id")
    op.drop_column("stock_movements", "transfer_id")
    op.drop_column("stock_movements", "purchase_order_id")
    op.drop_column("stock_movements", "project_id")
    op.drop_column("stock_movements", "destination_location_id")
    op.drop_column("stock_movements", "source_location_id")
    op.alter_column("stock_movements", "movement_type", type_=sa.String(30), existing_nullable=False)

    op.drop_table("audit_log")
    op.drop_table("product_stock")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("warehouse_transfer_items")
    op.drop_table("warehouse_transfers")
    op.drop_table("projects")
