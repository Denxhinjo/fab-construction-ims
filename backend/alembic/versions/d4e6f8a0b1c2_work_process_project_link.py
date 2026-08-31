"""work_process: add project_id FK

Revision ID: d4e6f8a0b1c2
Revises: b2c4d6e8f0a1
Create Date: 2026-08-31

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e6f8a0b1c2"
down_revision = "b2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "work_processes",
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_work_processes_project_id", "work_processes", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_work_processes_project_id", table_name="work_processes")
    op.drop_column("work_processes", "project_id")
