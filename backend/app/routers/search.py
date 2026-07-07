"""Title / ISBN search across external catalogs."""
from __future__ import annotations

import asyncio

import httpx
from fastapi import APIRouter, Query

from ..schemas import SearchCandidate
from ..services import metadata

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=list[SearchCandidate])
async def search(q: str = Query(..., min_length=1)) -> list[SearchCandidate]:
    """Search AniList + MangaDex (+ Google Books for ISBNs) and merge results.

    Romaji, native Japanese, or English titles all work. If the query looks
    like an ISBN, Google Books is queried first for an exact physical-book match.
    """
    q = q.strip()
    is_isbn = metadata.looks_like_isbn(q)

    async with httpx.AsyncClient(timeout=metadata._TIMEOUT) as client:
        tasks = [
            metadata.search_anilist(client, q),
            metadata.search_mangadex(client, q),
        ]
        if is_isbn or len(q) > 3:
            tasks.append(metadata.search_google_books(client, q))
        results = await asyncio.gather(*tasks, return_exceptions=True)

    candidates: list[SearchCandidate] = []
    for res in results:
        if isinstance(res, Exception):
            continue  # one source failing shouldn't sink the others
        candidates.extend(res)

    # ISBN searches: surface the exact-match book sources first.
    if is_isbn:
        candidates.sort(key=lambda c: 0 if c.source == "googlebooks" else 1)

    return candidates
