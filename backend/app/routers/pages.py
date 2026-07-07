"""Page CRUD + image upload.

Both webcam capture and file upload hit the same endpoint: the frontend posts
a JPEG/PNG blob as multipart form data. Pages are scoped to a book.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import images

router = APIRouter(prefix="/api", tags=["pages"])


def _get_page(db: Session, page_id: int) -> models.Page:
    page = db.get(models.Page, page_id)
    if not page:
        raise HTTPException(404, "Page not found")
    return page


@router.get("/books/{book_id}/pages", response_model=list[schemas.PageSummary])
def list_pages(book_id: int, db: Session = Depends(get_db)) -> list[models.Page]:
    if not db.get(models.Book, book_id):
        raise HTTPException(404, "Book not found")
    return list(
        db.scalars(
            select(models.Page)
            .where(models.Page.book_id == book_id)
            .order_by(models.Page.page_number)
        )
    )


@router.post("/books/{book_id}/pages", response_model=schemas.PageOut, status_code=201)
async def upload_page(
    book_id: int,
    image: UploadFile = File(...),
    page_number: int = Form(...),
    entry_id: int | None = Form(None),
    reading_order: str = Form("rtl"),
    db: Session = Depends(get_db),
) -> models.Page:
    """Create (or replace the image of) a page from an uploaded/captured image."""
    if not db.get(models.Book, book_id):
        raise HTTPException(404, "Book not found")

    raw = await image.read()
    if not raw:
        raise HTTPException(400, "Empty image upload")
    rel_path = images.save_page_image(raw, book_id, page_number)

    # Replace the image if this page number already exists.
    page = db.scalar(
        select(models.Page).where(
            models.Page.book_id == book_id,
            models.Page.page_number == page_number,
        )
    )
    if page:
        page.image_path = rel_path
        if entry_id is not None:
            page.entry_id = entry_id
    else:
        page = models.Page(
            book_id=book_id,
            page_number=page_number,
            entry_id=entry_id,
            image_path=rel_path,
            reading_order=reading_order,
        )
        db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.get("/pages/{page_id}", response_model=schemas.PageOut)
def get_page(page_id: int, db: Session = Depends(get_db)) -> models.Page:
    return _get_page(db, page_id)


@router.patch("/pages/{page_id}", response_model=schemas.PageOut)
def update_page(
    page_id: int, payload: schemas.PageUpdate, db: Session = Depends(get_db)
) -> models.Page:
    page = _get_page(db, page_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, key, value)
    db.commit()
    db.refresh(page)
    return page


@router.delete("/pages/{page_id}", status_code=204)
def delete_page(page_id: int, db: Session = Depends(get_db)) -> None:
    page = _get_page(db, page_id)
    db.delete(page)
    db.commit()
