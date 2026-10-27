"""
this file holds the shared pytest fixtures. tests run against an in-memory sqlite
database (through fastapi's dependency overrides) instead of the real postgres,
so the suite needs nothing running and can't touch dev/prod data
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
from app.models.product_stock import ProductStock
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
        except Exception:
            db_session.rollback()
            raise

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
    token = create_access_token(user.id, user.hashed_password[:8])
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
def viewer_user(db_session):
    return make_user(db_session, email="viewer@test.com", username="viewer", role="viewer")


def add_stock(db_session, product: Product, location: Location, quantity: float, minimum=None) -> ProductStock:
    """this function puts stock straight into a warehouse, keeping product.quantity in
    sync the way inventory_service does"""
    stock = ProductStock(product_id=product.id, location_id=location.id, quantity=quantity, min_quantity=minimum)
    product.quantity = (product.quantity or 0) + quantity
    db_session.add(stock)
    db_session.commit()
    return stock


@pytest.fixture()
def products_in_both_locations(db_session, two_locations):
    """this function makes product a with 10 in a (min 2) and product b with 1 in b (min 5, so below)"""
    loc_a, loc_b = two_locations
    product_a = Product(name="Product A", quantity=0, min_stock_level=2, unit="copë", avg_cost=5)
    product_b = Product(name="Product B", quantity=0, min_stock_level=5, unit="copë", avg_cost=10)
    db_session.add_all([product_a, product_b])
    db_session.commit()
    add_stock(db_session, product_a, loc_a, 10)
    add_stock(db_session, product_b, loc_b, 1)
    db_session.refresh(product_a)
    db_session.refresh(product_b)
    return product_a, product_b
