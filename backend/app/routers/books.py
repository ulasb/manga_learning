"""Book (physical volume / magazine) CRUD and their entries.

A book is the physical object you hold. A single-series volume has one entry
pointing at its series; a magazine/anthology has many entries, each mapping a
page range to a different series.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import images

router = APIRouter(prefix="/api/books", tags=["books"])


def _get_book(db: Session, book_id: int) -> models.Book:
    book = db.get(models.Book, book_id)
    if not book:
        raise HTTPException(404, "Book not found")
    return book


@router.get("", response_model=list[schemas.BookOut])
def list_books(db: Session = Depends(get_db)) -> list[models.Book]:
    return list(db.scalars(select(models.Book).order_by(models.Book.created_at.desc())))


@router.post("", response_model=schemas.BookOut, status_code=201)
async def create_book(payload: schemas.BookCreate, db: Session = Depends(get_db)) -> models.Book:
    data = payload.model_dump(exclude={"cover_url"})
    book = models.Book(**data, cover_url=payload.cover_url)
    db.add(book)
    db.commit()
    db.refresh(book)

    # A single-series volume gets an entry spanning the whole book automatically.
    if payload.series_id and payload.kind in ("volume", "other"):
        db.add(models.Entry(book_id=book.id, series_id=payload.series_id, order_index=0))
        db.commit()

    if payload.cover_url:
        rel = await images.download_cover(payload.cover_url, "book", book.id)
        if rel:
            book.cover_path = rel
            db.commit()
    db.refresh(book)
    return book


@router.get("/{book_id}", response_model=schemas.BookOut)
def get_book(book_id: int, db: Session = Depends(get_db)) -> models.Book:
    return _get_book(db, book_id)


@router.patch("/{book_id}", response_model=schemas.BookOut)
def update_book(
    book_id: int, payload: schemas.BookUpdate, db: Session = Depends(get_db)
) -> models.Book:
    book = _get_book(db, book_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(book, key, value)
    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=204)
def delete_book(book_id: int, db: Session = Depends(get_db)) -> None:
    book = _get_book(db, book_id)
    db.delete(book)
    db.commit()


# ----- Entries (sections within a book) -----

@router.get("/{book_id}/entries", response_model=list[schemas.EntryOut])
def list_entries(book_id: int, db: Session = Depends(get_db)) -> list[models.Entry]:
    _get_book(db, book_id)
    return list(
        db.scalars(
            select(models.Entry)
            .where(models.Entry.book_id == book_id)
            .order_by(models.Entry.order_index)
        )
    )


@router.post("/{book_id}/entries", response_model=schemas.EntryOut, status_code=201)
def create_entry(
    book_id: int, payload: schemas.EntryCreate, db: Session = Depends(get_db)
) -> models.Entry:
    _get_book(db, book_id)
    entry = models.Entry(book_id=book_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}", response_model=schemas.EntryOut)
def update_entry(
    entry_id: int, payload: schemas.EntryUpdate, db: Session = Depends(get_db)
) -> models.Entry:
    entry = db.get(models.Entry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)) -> None:
    entry = db.get(models.Entry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
