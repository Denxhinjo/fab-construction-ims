"""
Shared pytest fixtures. Tests run against an in-memory SQLite database (via
FastAPI's dependency-override mechanism) rather than the real Postgres
instance, so the suite needs nothing running and can't touch dev/prod data.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from passlib.context import CryptContext

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.models.location import Location
from app.models.product import Product
from app.routers.auth import create_access_token

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_user(db_session, *, email, username, role="user", full_name="Test User", password="Password123"):
    user = User(
        email=email,
        username=username,
        full_name=full_name,
        hashed_password=pwd_context.hash(password),
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def user_factory(db_session):
    def _factory(**kwargs):
        return make_user(db_session, **kwargs)
    return _factory


@pytest.fixture()
def admin_user(db_session):
    return make_user(db_session, email="admin@test.com", username="admin", role="admin")


@pytest.fixture()
def regular_user(db_session):
    return make_user(db_session, email="user@test.com", username="user", role="user")


@pytest.fixture()
def admin_headers(admin_user):
    return auth_headers(admin_user)


@pytest.fixture()
def user_headers(regular_user):
    return auth_headers(regular_user)


@pytest.fixture()
def two_locations(db_session):
    loc_a = Location(name="Warehouse A")
    loc_b = Location(name="Warehouse B")
    db_session.add_all([loc_a, loc_b])
    db_session.commit()
    db_session.refresh(loc_a)
    db_session.refresh(loc_b)
    return loc_a, loc_b


@pytest.fixture()
def grant_location(db_session):
    def _grant(user: User, location: Location):
        user.permitted_locations.append(location)
        db_session.commit()
    return _grant


@pytest.fixture()
def products_in_both_locations(db_session, two_locations):
    loc_a, loc_b = two_locations
    product_a = Product(name="Product A", quantity=10, min_stock_level=2, location_id=loc_a.id, unit_price=5)
    product_b = Product(name="Product B", quantity=1, min_stock_level=5, location_id=loc_b.id, unit_price=10)
    db_session.add_all([product_a, product_b])
    db_session.commit()
    db_session.refresh(product_a)
    db_session.refresh(product_b)
    return product_a, product_b
