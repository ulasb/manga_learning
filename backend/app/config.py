"""Application configuration and shared paths."""
from pathlib import Path

# backend/app/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
COVERS_DIR = IMAGES_DIR / "covers"
PAGES_DIR = IMAGES_DIR / "pages"
DB_PATH = DATA_DIR / "manga.db"

for _d in (DATA_DIR, IMAGES_DIR, COVERS_DIR, PAGES_DIR):
    _d.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

# Frontend dev server origin, allowed for CORS.
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
