from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Render/Neon provide postgres:// but SQLAlchemy 2 requires postgresql://
_db_url = settings.DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Small pool: serverless functions cold-start per invocation, so the
# connection pooler (e.g. Neon's PgBouncer) handles concurrency, not us.
engine = create_engine(
    _db_url,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=5,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
