"""FastAPI application entry point."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, IMAGES_DIR
from .database import init_db
from .routers import books, glossary, pages, panels, search, series

app = FastAPI(title="Manga Learning API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


app.include_router(search.router)
app.include_router(series.router)
app.include_router(books.router)
app.include_router(pages.router)
app.include_router(panels.router)
app.include_router(glossary.router)

# Serve stored cover + page images.
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
