"""External metadata lookups for manga identification.

Sources, queried in parallel:
  - AniList (GraphQL): strong romaji/native/English title search + covers.
  - MangaDex (REST): strong manga + Japanese-title coverage + covers.
  - Google Books (REST): used for ISBN lookups (physical books).

Each returns a list of SearchCandidate. The caller (search router) merges them
and lets the user pick. Network failures from one source are swallowed so the
others still return results.
"""
from __future__ import annotations

import os
import re

import httpx

from ..schemas import SearchCandidate

ANILIST_URL = "https://graphql.anilist.co"
MANGADEX_URL = "https://api.mangadex.org"
GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

_TIMEOUT = httpx.Timeout(15.0)
_HEADERS = {"User-Agent": "manga-learning/0.1 (personal learning tool)"}

ISBN_RE = re.compile(r"^(?:97[89])?\d{9}[\dxX]$")


def looks_like_isbn(query: str) -> bool:
    cleaned = re.sub(r"[\s-]", "", query)
    return bool(ISBN_RE.match(cleaned))


_ANILIST_QUERY = """
query ($search: String) {
  Page(page: 1, perPage: 12) {
    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
      id
      title { romaji native english }
      description(asHtml: false)
      coverImage { large }
      startDate { year }
      format
      volumes
      chapters
      genres
      staff(perPage: 4) {
        edges { role node { name { full } } }
      }
    }
  }
}
"""


def _anilist_author(staff: dict) -> str | None:
    edges = (staff or {}).get("edges") or []
    for edge in edges:
        role = (edge.get("role") or "").lower()
        if "story" in role or "art" in role:
            name = (edge.get("node") or {}).get("name") or {}
            if name.get("full"):
                return name["full"]
    # fall back to first listed staff member
    if edges:
        name = (edges[0].get("node") or {}).get("name") or {}
        return name.get("full")
    return None


async def search_anilist(client: httpx.AsyncClient, query: str) -> list[SearchCandidate]:
    resp = await client.post(
        ANILIST_URL,
        json={"query": _ANILIST_QUERY, "variables": {"search": query}},
        headers=_HEADERS,
    )
    resp.raise_for_status()
    media = (resp.json().get("data") or {}).get("Page", {}).get("media") or []
    out: list[SearchCandidate] = []
    for m in media:
        title = m.get("title") or {}
        desc = m.get("description")
        if desc:
            desc = re.sub(r"<[^>]+>", "", desc).strip()
        out.append(
            SearchCandidate(
                source="anilist",
                source_id=str(m["id"]),
                title_romaji=title.get("romaji"),
                title_native=title.get("native"),
                title_english=title.get("english"),
                author=_anilist_author(m.get("staff") or {}),
                description=desc,
                cover_url=(m.get("coverImage") or {}).get("large"),
                year=(m.get("startDate") or {}).get("year"),
                format=m.get("format"),
                volume_count=m.get("volumes"),
                chapter_count=m.get("chapters"),
                genres=m.get("genres") or [],
            )
        )
    return out


async def search_mangadex(client: httpx.AsyncClient, query: str) -> list[SearchCandidate]:
    resp = await client.get(
        f"{MANGADEX_URL}/manga",
        params=[
            ("title", query),
            ("limit", "12"),
            ("includes[]", "cover_art"),
            ("includes[]", "author"),
            ("includes[]", "artist"),
            ("contentRating[]", "safe"),
            ("contentRating[]", "suggestive"),
            ("contentRating[]", "erotica"),
        ],
        headers=_HEADERS,
    )
    resp.raise_for_status()
    data = resp.json().get("data") or []
    out: list[SearchCandidate] = []
    for m in data:
        attrs = m.get("attributes") or {}
        titles = attrs.get("title") or {}
        alt = {}
        for entry in attrs.get("altTitles") or []:
            alt.update(entry)

        title_romaji = titles.get("ja-ro") or alt.get("ja-ro") or titles.get("en")
        title_native = titles.get("ja") or alt.get("ja")
        title_english = titles.get("en") or alt.get("en")

        descriptions = attrs.get("description") or {}
        desc = descriptions.get("en") or next(iter(descriptions.values()), None)

        author = None
        cover_file = None
        for rel in m.get("relationships") or []:
            rtype = rel.get("type")
            rattrs = rel.get("attributes") or {}
            if rtype == "author" and not author:
                author = rattrs.get("name")
            elif rtype == "cover_art":
                cover_file = rattrs.get("fileName")

        cover_url = (
            f"{MANGADEX_URL.replace('api.', 'uploads.')}/covers/{m['id']}/{cover_file}.256.jpg"
            if cover_file
            else None
        )
        # uploads host is uploads.mangadex.org
        if cover_file:
            cover_url = f"https://uploads.mangadex.org/covers/{m['id']}/{cover_file}.512.jpg"

        out.append(
            SearchCandidate(
                source="mangadex",
                source_id=m["id"],
                title_romaji=title_romaji,
                title_native=title_native,
                title_english=title_english,
                author=author,
                description=desc,
                cover_url=cover_url,
                year=attrs.get("year"),
                format="MANGA",
                chapter_count=int(attrs["lastChapter"])
                if (attrs.get("lastChapter") or "").isdigit()
                else None,
            )
        )
    return out


async def search_google_books(client: httpx.AsyncClient, query: str) -> list[SearchCandidate]:
    if looks_like_isbn(query):
        q = f"isbn:{re.sub(r'[\\s-]', '', query)}"
    else:
        q = query
    params = {"q": q, "maxResults": 10}
    # Optional API key lifts the small unauthenticated quota.
    api_key = os.environ.get("GOOGLE_BOOKS_API_KEY")
    if api_key:
        params["key"] = api_key
    resp = await client.get(GOOGLE_BOOKS_URL, params=params, headers=_HEADERS)
    resp.raise_for_status()
    items = resp.json().get("items") or []
    out: list[SearchCandidate] = []
    for it in items:
        info = it.get("volumeInfo") or {}
        isbn = None
        for ident in info.get("industryIdentifiers") or []:
            if ident.get("type") in ("ISBN_13", "ISBN_10"):
                isbn = ident.get("identifier")
                if ident.get("type") == "ISBN_13":
                    break
        year = None
        published = info.get("publishedDate") or ""
        if published[:4].isdigit():
            year = int(published[:4])
        images = info.get("imageLinks") or {}
        out.append(
            SearchCandidate(
                source="googlebooks",
                source_id=it.get("id", ""),
                title_romaji=info.get("title"),
                title_native=info.get("title"),
                author=", ".join(info.get("authors") or []) or None,
                description=info.get("description"),
                cover_url=(images.get("thumbnail") or images.get("smallThumbnail") or "").replace(
                    "http://", "https://"
                )
                or None,
                year=year,
                isbn=isbn,
            )
        )
    return out
