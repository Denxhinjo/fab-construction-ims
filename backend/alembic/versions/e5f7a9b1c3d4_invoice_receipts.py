"""this migration adds invoice receipts, per-warehouse minimums and simplified transfers

Revision ID: e5f7a9b1c3d4
Revises: d4e6f8a0b1c2
Create Date: 2026-10-26

the tables of the removed features (projects, purchase orders, work processes)
are left in place with their data on purpose
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f7a9b1c3d4"
down_revision = "d4e6f8a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="review"),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False, server_default="0"),
        sa.Column("file_data", sa.LargeBinary, nullable=False),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("used_ocr", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("read_issues", sa.Text, nullable=True),
        sa.Column("supplier_name_raw", sa.String(255), nullable=True),
        sa.Column("supplier_tax_number", sa.String(50), nullable=True),
        sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id"), nullable=True),
        sa.Column("invoice_number", sa.String(100), nullable=True),
        sa.Column("invoice_date", sa.Date, nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="ALL"),
        sa.Column("subtotal", sa.Float, nullable=True),
        sa.Column("vat_total", sa.Float, nullable=True),
        sa.Column("total", sa.Float, nullable=True),
        sa.Column("location_id", sa.Integer, sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("accepted_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"])
    op.create_index("ix_invoices_created_at", "invoices", ["created_at"])

    op.create_table(
        "invoice_lines",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_no", sa.Integer, nullable=False),
        sa.Column("code", sa.String(100), nullable=True),
        sa.Column("raw_description", sa.String(500), nullable=True),
        sa.Column("raw_unit", sa.String(50), nullable=True),
        sa.Column("kind", sa.String(10), nullable=False, server_default="stock"),
        sa.Column("quantity", sa.Float, nullable=True),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("unit_price", sa.Float, nullable=True),
        sa.Column("net_amount", sa.Float, nullable=True),
        sa.Column("vat_amount", sa.Float, nullable=True),
        sa.Column("gross_amount", sa.Float, nullable=True),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="check"),
        sa.Column("issues", sa.Text, nullable=True),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id"), nullable=True),
        sa.Column("match_method", sa.String(20), nullable=True),
        sa.Column("new_name", sa.String(255), nullable=True),
        sa.Column("new_category", sa.String(100), nullable=True),
        sa.Column("new_min", sa.Float, nullable=True),
    )
    op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])

    op.create_table(
        "supplier_product_aliases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("key", sa.String(500), nullable=False),
        sa.Column("product_id", sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("supplier_id", "kind", "key", name="uq_supplier_alias"),
    )

    op.add_column("product_stock", sa.Column("min_quantity", sa.Float, nullable=True))
    op.add_column("warehouse_transfers", sa.Column("driver", sa.String(255), nullable=True))
    op.add_column("stock_movements", sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id"), nullable=True))
    op.create_index("ix_stock_movements_invoice_id", "stock_movements", ["invoice_id"])

    #this block gives every product made through the old product form its product_stock
    #row, since those carried their stock only as products.quantity + one location_id
    #and stock is now read per warehouse
    op.execute("""
        INSERT INTO product_stock (product_id, location_id, quantity, reserved_quantity)
        SELECT p.id, p.location_id, p.quantity, 0
        FROM products p
        WHERE p.location_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM product_stock s WHERE s.product_id = p.id)
    """)

    #this block closes transfers still waiting in the old approval steps, since they
    #never moved stock and the new flow has no approval step
    op.execute("""
        UPDATE warehouse_transfers SET status = 'CANCELLED'
        WHERE status IN ('DRAFT', 'PENDING', 'APPROVED')
    """)


def downgrade() -> None:
    op.drop_index("ix_stock_movements_invoice_id", table_name="stock_movements")
    op.drop_column("stock_movements", "invoice_id")
    op.drop_column("warehouse_transfers", "driver")
    op.drop_column("product_stock", "min_quantity")
    op.drop_table("supplier_product_aliases")
    op.drop_index("ix_invoice_lines_invoice_id", table_name="invoice_lines")
    op.drop_table("invoice_lines")
    op.drop_index("ix_invoices_created_at", table_name="invoices")
    op.drop_index("ix_invoices_invoice_number", table_name="invoices")
    op.drop_index("ix_invoices_status", table_name="invoices")
    op.drop_table("invoices")
