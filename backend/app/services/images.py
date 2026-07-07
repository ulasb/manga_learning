"""Local image storage: cover downloads and page-image saves.

Images live under backend/data/images/{covers,pages}. The DB stores a path
relative to the images root (e.g. "covers/series-12.jpg"); FastAPI serves the
images root statically at /images.
"""
from __future__ import annotations

import io

import httpx
from PIL import Image

from ..config import COVERS_DIR, IMAGES_DIR, PAGES_DIR

_HEADERS = {"User-Agent": "manga-learning/0.1 (personal learning tool)"}
_MAX_COVER_W = 600
_MAX_PAGE_W = 2000


def _rel(path) -> str:
    return str(path.relative_to(IMAGES_DIR)).replace("\\", "/")


def _save_image(raw: bytes, dest, max_width: int) -> str:
    """Decode, optionally downscale, save as JPEG, return images-relative path."""
    img = Image.open(io.BytesIO(raw))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
    img.save(dest, "JPEG", quality=88)
    return _rel(dest)


async def download_cover(url: str, kind: str, obj_id: int) -> str | None:
    """Fetch a remote cover and store it. Returns images-relative path or None."""
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            dest = COVERS_DIR / f"{kind}-{obj_id}.jpg"
            return _save_image(resp.content, dest, _MAX_COVER_W)
    except (httpx.HTTPError, OSError):
        return None


def save_page_image(raw: bytes, book_id: int, page_number: int) -> str:
    """Store an uploaded/captured page image. Returns images-relative path."""
    dest = PAGES_DIR / f"book-{book_id}-page-{page_number}.jpg"
    return _save_image(raw, dest, _MAX_PAGE_W)
