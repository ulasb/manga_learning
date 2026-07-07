"""Series library CRUD."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import images

router = APIRouter(prefix="/api/series", tags=["series"])


@router.get("", response_model=list[schemas.SeriesOut])
def list_series(db: Session = Depends(get_db)) -> list[models.Series]:
    return list(db.scalars(select(models.Series).order_by(models.Series.title_romaji)))


@router.post("", response_model=schemas.SeriesOut, status_code=201)
async def create_series(
    payload: schemas.SeriesCreate, db: Session = Depends(get_db)
) -> models.Series:
    """Add a series to the library (typically from a chosen search candidate).

    If the series already exists by source id, the existing row is returned.
    """
    if payload.source_id and payload.source != "manual":
        existing = db.scalar(
            select(models.Series).where(
                models.Series.source == payload.source,
                models.Series.source_id == payload.source_id,
            )
        )
        if existing:
            return existing

    data = payload.model_dump(exclude={"genres"})
    series = models.Series(**data, genres=json.dumps(payload.genres))
    if payload.source == "anilist" and payload.source_id:
        series.anilist_id = int(payload.source_id)
    elif payload.source == "mangadex" and payload.source_id:
        series.mangadex_id = payload.source_id

    db.add(series)
    db.commit()
    db.refresh(series)

    if payload.cover_url:
        rel = await images.download_cover(payload.cover_url, "series", series.id)
        if rel:
            series.cover_path = rel
            db.commit()
            db.refresh(series)
    return series


def _get_series(db: Session, series_id: int) -> models.Series:
    series = db.get(models.Series, series_id)
    if not series:
        raise HTTPException(404, "Series not found")
    return series


@router.get("/{series_id}", response_model=schemas.SeriesOut)
def get_series(series_id: int, db: Session = Depends(get_db)) -> models.Series:
    return _get_series(db, series_id)


@router.patch("/{series_id}", response_model=schemas.SeriesOut)
def update_series(
    series_id: int, payload: schemas.SeriesUpdate, db: Session = Depends(get_db)
) -> models.Series:
    series = _get_series(db, series_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(series, key, value)
    db.commit()
    db.refresh(series)
    return series


@router.delete("/{series_id}", status_code=204)
def delete_series(series_id: int, db: Session = Depends(get_db)) -> None:
    series = _get_series(db, series_id)
    db.delete(series)
    db.commit()
