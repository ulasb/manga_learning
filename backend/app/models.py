"""SQLAlchemy ORM models.

Domain shape:
  Series   -- the work itself (One Piece). Metadata + cover + per-series glossary.
  Book     -- a physical object: a tankoubon volume OR a magazine/anthology.
  Entry    -- a section of a Book mapping to one Series (a chapter run).
              A volume has one Entry; a magazine has many.
  Page     -- a physical page in a Book; carries the image and panel_count.
  Panel    -- a single panel on a Page; the unit of translation.
  GlossaryTerm -- per-Series running context (characters, vocab, phrases).
"""
import datetime as dt

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow
    )


class Series(Base, TimestampMixin):
    __tablename__ = "series"

    id: Mapped[int] = mapped_column(primary_key=True)
    title_romaji: Mapped[str | None] = mapped_column(String)
    title_native: Mapped[str | None] = mapped_column(String)  # Japanese
    title_english: Mapped[str | None] = mapped_column(String)

    source: Mapped[str] = mapped_column(String, default="manual")  # anilist|mangadex|manual
    source_id: Mapped[str | None] = mapped_column(String)
    anilist_id: Mapped[int | None] = mapped_column(Integer)
    mangadex_id: Mapped[str | None] = mapped_column(String)

    author: Mapped[str | None] = mapped_column(String)
    artist: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)

    cover_path: Mapped[str | None] = mapped_column(String)  # local relative path
    cover_url: Mapped[str | None] = mapped_column(String)  # original remote url

    status: Mapped[str] = mapped_column(String, default="want_to_read")
    # reading | completed | paused | want_to_read | dropped
    format: Mapped[str | None] = mapped_column(String)
    year: Mapped[int | None] = mapped_column(Integer)
    volume_count: Mapped[int | None] = mapped_column(Integer)
    chapter_count: Mapped[int | None] = mapped_column(Integer)
    genres: Mapped[str | None] = mapped_column(Text)  # JSON-encoded list

    entries: Mapped[list["Entry"]] = relationship(back_populates="series")
    glossary: Mapped[list["GlossaryTerm"]] = relationship(
        back_populates="series", cascade="all, delete-orphan"
    )


class Book(Base, TimestampMixin):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String, default="volume")  # volume|magazine|anthology|other
    title: Mapped[str] = mapped_column(String)
    # set for single-series volumes; null for magazines/anthologies
    series_id: Mapped[int | None] = mapped_column(ForeignKey("series.id"))
    volume_number: Mapped[int | None] = mapped_column(Integer)
    issue_label: Mapped[str | None] = mapped_column(String)
    isbn: Mapped[str | None] = mapped_column(String)
    publisher: Mapped[str | None] = mapped_column(String)
    year: Mapped[int | None] = mapped_column(Integer)
    cover_path: Mapped[str | None] = mapped_column(String)
    cover_url: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="unread")  # unread|reading|finished

    series: Mapped["Series | None"] = relationship()
    entries: Mapped[list["Entry"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="Entry.order_index",
    )
    pages: Mapped[list["Page"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="Page.page_number",
    )


class Entry(Base, TimestampMixin):
    """A contiguous section of a Book belonging to one Series."""

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"))
    series_id: Mapped[int | None] = mapped_column(ForeignKey("series.id"))  # null = filler/unknown
    title: Mapped[str | None] = mapped_column(String)  # chapter title
    chapter_number: Mapped[str | None] = mapped_column(String)  # "1090", "Extra", etc.
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    start_page: Mapped[int | None] = mapped_column(Integer)
    end_page: Mapped[int | None] = mapped_column(Integer)

    book: Mapped["Book"] = relationship(back_populates="entries")
    series: Mapped["Series | None"] = relationship(back_populates="entries")


class Page(Base, TimestampMixin):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id"))
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("entries.id"))
    page_number: Mapped[int] = mapped_column(Integer)
    image_path: Mapped[str | None] = mapped_column(String)  # local relative path
    panel_count: Mapped[int] = mapped_column(Integer, default=0)  # the "y" in x of y
    status: Mapped[str] = mapped_column(String, default="untranslated")
    # untranslated | in_progress | translated | needs_review
    reading_order: Mapped[str] = mapped_column(String, default="rtl")  # manga = right-to-left
    notes: Mapped[str | None] = mapped_column(Text)

    book: Mapped["Book"] = relationship(back_populates="pages")
    entry: Mapped["Entry | None"] = relationship()
    panels: Mapped[list["Panel"]] = relationship(
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="Panel.panel_index",
    )


class Panel(Base, TimestampMixin):
    __tablename__ = "panels"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(ForeignKey("pages.id"))
    panel_index: Mapped[int] = mapped_column(Integer)  # the "x" in x of y (1-based)
    panel_type: Mapped[str] = mapped_column(String, default="dialogue")
    # dialogue | narration | sfx | sign | thought | aside
    speaker: Mapped[str | None] = mapped_column(String)
    original_text: Mapped[str | None] = mapped_column(Text)  # Japanese as written
    reading: Mapped[str | None] = mapped_column(Text)  # kana / furigana
    romaji: Mapped[str | None] = mapped_column(Text)
    translation: Mapped[str | None] = mapped_column(Text)
    literal: Mapped[str | None] = mapped_column(Text)  # literal gloss
    notes: Mapped[str | None] = mapped_column(Text)  # grammar / vocab learning notes
    bbox: Mapped[str | None] = mapped_column(String)  # optional JSON [x,y,w,h], normalized 0-1
    needs_context: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[str | None] = mapped_column(String)  # high | medium | low

    page: Mapped["Page"] = relationship(back_populates="panels")


class GlossaryTerm(Base, TimestampMixin):
    __tablename__ = "glossary"

    id: Mapped[int] = mapped_column(primary_key=True)
    series_id: Mapped[int] = mapped_column(ForeignKey("series.id"))
    term: Mapped[str] = mapped_column(String)  # Japanese
    reading: Mapped[str | None] = mapped_column(String)
    romaji: Mapped[str | None] = mapped_column(String)
    meaning: Mapped[str | None] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, default="vocab")
    # character | place | phrase | vocab | grammar | sfx
    notes: Mapped[str | None] = mapped_column(Text)
    first_seen_page_id: Mapped[int | None] = mapped_column(ForeignKey("pages.id"))

    series: Mapped["Series"] = relationship(back_populates="glossary")
