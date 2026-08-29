"""product: multi-image and price_currency

Revision ID: b2c4d6e8f0a1
Revises: 3a8f2c10d4e5
Create Date: 2026-08-30

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c4d6e8f0a1"
down_revision = "3a8f2c10d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("image_url_2", sa.String(500), nullable=True))
    op.add_column("products", sa.Column("image_url_3", sa.String(500), nullable=True))
    op.add_column("products", sa.Column("price_currency", sa.String(3), nullable=False, server_default="ALL"))


def downgrade() -> None:
    op.drop_column("products", "price_currency")
    op.drop_column("products", "image_url_3")
    op.drop_column("products", "image_url_2")
