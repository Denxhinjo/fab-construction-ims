from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

#this line fixes the url because render/neon give postgres:// but sqlalchemy 2 needs postgresql://
_db_url = settings.DATABASE_URL.replace("postgres://", "postgresql://", 1)

#this line keeps the pool small: serverless functions cold-start per request, so the
#connection pooler (e.g. neon's pgbouncer) handles concurrency, not us
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
    except Exception:
        #this line undoes a request that fails half-way (e.g. the third row of an invoice
        #is refused after two were flushed) so it leaves nothing behind
        db.rollback()
        raise
    finally:
        db.close()
