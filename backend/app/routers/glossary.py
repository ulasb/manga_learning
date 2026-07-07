"""Per-series glossary CRUD — running translation context + study list."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["glossary"])


@router.get("/series/{series_id}/glossary", response_model=list[schemas.GlossaryOut])
def list_glossary(series_id: int, db: Session = Depends(get_db)) -> list[models.GlossaryTerm]:
    if not db.get(models.Series, series_id):
        raise HTTPException(404, "Series not found")
    return list(
        db.scalars(
            select(models.GlossaryTerm)
            .where(models.GlossaryTerm.series_id == series_id)
            .order_by(models.GlossaryTerm.type, models.GlossaryTerm.term)
        )
    )


@router.post("/series/{series_id}/glossary", response_model=schemas.GlossaryOut, status_code=201)
def create_term(
    series_id: int, payload: schemas.GlossaryCreate, db: Session = Depends(get_db)
) -> models.GlossaryTerm:
    if not db.get(models.Series, series_id):
        raise HTTPException(404, "Series not found")
    term = models.GlossaryTerm(series_id=series_id, **payload.model_dump())
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.patch("/glossary/{term_id}", response_model=schemas.GlossaryOut)
def update_term(
    term_id: int, payload: schemas.GlossaryUpdate, db: Session = Depends(get_db)
) -> models.GlossaryTerm:
    term = db.get(models.GlossaryTerm, term_id)
    if not term:
        raise HTTPException(404, "Term not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(term, key, value)
    db.commit()
    db.refresh(term)
    return term


@router.delete("/glossary/{term_id}", status_code=204)
def delete_term(term_id: int, db: Session = Depends(get_db)) -> None:
    term = db.get(models.GlossaryTerm, term_id)
    if not term:
        raise HTTPException(404, "Term not found")
    db.delete(term)
    db.commit()
