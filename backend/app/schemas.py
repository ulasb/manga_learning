"""Pydantic request/response schemas."""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ----- Search (external metadata lookup) -----

class SearchCandidate(BaseModel):
    """A possible match returned from AniList / MangaDex / Google Books."""
    source: str  # anilist | mangadex | googlebooks
    source_id: str
    title_romaji: str | None = None
    title_native: str | None = None
    title_english: str | None = None
    author: str | None = None
    description: str | None = None
    cover_url: str | None = None
    year: int | None = None
    format: str | None = None
    volume_count: int | None = None
    chapter_count: int | None = None
    isbn: str | None = None
    genres: list[str] = []


# ----- Series -----

class SeriesCreate(BaseModel):
    """Add a series to the library, usually from a chosen SearchCandidate."""
    title_romaji: str | None = None
    title_native: str | None = None
    title_english: str | None = None
    source: str = "manual"
    source_id: str | None = None
    anilist_id: int | None = None
    mangadex_id: str | None = None
    author: str | None = None
    artist: str | None = None
    description: str | None = None
    cover_url: str | None = None
    status: str = "want_to_read"
    format: str | None = None
    year: int | None = None
    volume_count: int | None = None
    chapter_count: int | None = None
    genres: list[str] = []


class SeriesUpdate(BaseModel):
    title_romaji: str | None = None
    title_native: str | None = None
    title_english: str | None = None
    author: str | None = None
    artist: str | None = None
    description: str | None = None
    status: str | None = None
    year: int | None = None
    volume_count: int | None = None
    chapter_count: int | None = None


class SeriesOut(ORMModel):
    id: int
    title_romaji: str | None
    title_native: str | None
    title_english: str | None
    source: str
    anilist_id: int | None
    mangadex_id: str | None
    author: str | None
    artist: str | None
    description: str | None
    cover_path: str | None
    cover_url: str | None
    status: str
    format: str | None
    year: int | None
    volume_count: int | None
    chapter_count: int | None
    created_at: dt.datetime
    updated_at: dt.datetime


# ----- Books / Entries -----

class BookCreate(BaseModel):
    kind: str = "volume"  # volume | magazine | anthology | other
    title: str
    series_id: int | None = None
    volume_number: int | None = None
    issue_label: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    year: int | None = None
    cover_url: str | None = None


class BookUpdate(BaseModel):
    title: str | None = None
    kind: str | None = None
    series_id: int | None = None
    volume_number: int | None = None
    issue_label: str | None = None
    isbn: str | None = None
    publisher: str | None = None
    year: int | None = None
    status: str | None = None


class EntryCreate(BaseModel):
    series_id: int | None = None
    title: str | None = None
    chapter_number: str | None = None
    order_index: int = 0
    start_page: int | None = None
    end_page: int | None = None


class EntryUpdate(BaseModel):
    series_id: int | None = None
    title: str | None = None
    chapter_number: str | None = None
    order_index: int | None = None
    start_page: int | None = None
    end_page: int | None = None


class EntryOut(ORMModel):
    id: int
    book_id: int
    series_id: int | None
    title: str | None
    chapter_number: str | None
    order_index: int
    start_page: int | None
    end_page: int | None
    series: SeriesOut | None = None


class BookOut(ORMModel):
    id: int
    kind: str
    title: str
    series_id: int | None
    volume_number: int | None
    issue_label: str | None
    isbn: str | None
    publisher: str | None
    year: int | None
    cover_path: str | None
    cover_url: str | None
    status: str
    created_at: dt.datetime
    updated_at: dt.datetime
    entries: list[EntryOut] = []


# ----- Panels -----

class PanelCreate(BaseModel):
    panel_index: int
    panel_type: str = "dialogue"
    speaker: str | None = None
    original_text: str | None = None
    reading: str | None = None
    romaji: str | None = None
    translation: str | None = None
    literal: str | None = None
    notes: str | None = None
    bbox: str | None = None
    needs_context: bool = False
    confidence: str | None = None


class PanelUpdate(BaseModel):
    panel_index: int | None = None
    panel_type: str | None = None
    speaker: str | None = None
    original_text: str | None = None
    reading: str | None = None
    romaji: str | None = None
    translation: str | None = None
    literal: str | None = None
    notes: str | None = None
    bbox: str | None = None
    needs_context: bool | None = None
    confidence: str | None = None


class PanelOut(ORMModel):
    id: int
    page_id: int
    panel_index: int
    panel_type: str
    speaker: str | None
    original_text: str | None
    reading: str | None
    romaji: str | None
    translation: str | None
    literal: str | None
    notes: str | None
    bbox: str | None
    needs_context: bool
    confidence: str | None
    updated_at: dt.datetime


# ----- Pages -----

class PageUpdate(BaseModel):
    page_number: int | None = None
    entry_id: int | None = None
    panel_count: int | None = None
    status: str | None = None
    reading_order: str | None = None
    notes: str | None = None


class PageOut(ORMModel):
    id: int
    book_id: int
    entry_id: int | None
    page_number: int
    image_path: str | None
    panel_count: int
    status: str
    reading_order: str
    notes: str | None
    created_at: dt.datetime
    updated_at: dt.datetime
    panels: list[PanelOut] = []


class PageSummary(ORMModel):
    """Lightweight page listing without panels."""
    id: int
    book_id: int
    entry_id: int | None
    page_number: int
    image_path: str | None
    panel_count: int
    status: str


# ----- Glossary -----

class GlossaryCreate(BaseModel):
    term: str
    reading: str | None = None
    romaji: str | None = None
    meaning: str | None = None
    type: str = "vocab"
    notes: str | None = None
    first_seen_page_id: int | None = None


class GlossaryUpdate(BaseModel):
    term: str | None = None
    reading: str | None = None
    romaji: str | None = None
    meaning: str | None = None
    type: str | None = None
    notes: str | None = None


class GlossaryOut(ORMModel):
    id: int
    series_id: int
    term: str
    reading: str | None
    romaji: str | None
    meaning: str | None
    type: str
    notes: str | None
    first_seen_page_id: int | None
    updated_at: dt.datetime
