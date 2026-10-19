import pytest
from app.db.connection import get_db
from app.db.seed_data import seed_database
from app.db.indexes import ensure_indexes
from app.db.schemas import apply_json_schema_validators


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Session fixture that ensures the test database has collection schemas,
    indexes, and a populated 180-day dataset.
    """
    db = get_db()
    apply_json_schema_validators(db)
    ensure_indexes(db)
    seed_database(db, force=True)
    yield
