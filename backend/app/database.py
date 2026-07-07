"""SQLAlchemy engine, session, and schema creation."""
from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    # check_same_thread: allow use across FastAPI threads.
    # timeout: wait (don't error) when another connection holds a write lock —
    #   lets the server and the translation CLI write concurrently.
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def _enable_sqlite_fk(dbapi_connection, _):
    """Per-connection SQLite pragmas: FK enforcement, WAL, and a busy timeout.

    WAL lets readers and a writer coexist; the busy timeout makes extra writers
    queue instead of failing with 'database is locked' during concurrent imports.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Create all tables. Safe to call repeatedly."""
    from . import models  # noqa: F401 — register models on Base

    models.Base.metadata.create_all(bind=engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
