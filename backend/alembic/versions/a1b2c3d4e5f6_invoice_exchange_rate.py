"""this migration adds the invoice exchange rate

Revision ID: a1b2c3d4e5f6
Revises: e5f7a9b1c3d4
Create Date: 2026-10-27

foreign-currency invoices (eur e-invoices) carry the rate to lek, so their
prices can be converted before they reach a material's average cost
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "e5f7a9b1c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("exchange_rate", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("invoices", "exchange_rate")
