"""Panel CRUD — the unit of translation, scoped to a page."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api", tags=["panels"])


@router.get("/pages/{page_id}/panels", response_model=list[schemas.PanelOut])
def list_panels(page_id: int, db: Session = Depends(get_db)) -> list[models.Panel]:
    if not db.get(models.Page, page_id):
        raise HTTPException(404, "Page not found")
    return list(
        db.scalars(
            select(models.Panel)
            .where(models.Panel.page_id == page_id)
            .order_by(models.Panel.panel_index)
        )
    )


@router.post("/pages/{page_id}/panels", response_model=schemas.PanelOut, status_code=201)
def create_panel(
    page_id: int, payload: schemas.PanelCreate, db: Session = Depends(get_db)
) -> models.Panel:
    page = db.get(models.Page, page_id)
    if not page:
        raise HTTPException(404, "Page not found")
    panel = models.Panel(page_id=page_id, **payload.model_dump())
    db.add(panel)
    # keep the page's panel_count in step with the highest panel index seen
    page.panel_count = max(page.panel_count, payload.panel_index)
    db.commit()
    db.refresh(panel)
    return panel


@router.patch("/panels/{panel_id}", response_model=schemas.PanelOut)
def update_panel(
    panel_id: int, payload: schemas.PanelUpdate, db: Session = Depends(get_db)
) -> models.Panel:
    panel = db.get(models.Panel, panel_id)
    if not panel:
        raise HTTPException(404, "Panel not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(panel, key, value)
    db.commit()
    db.refresh(panel)
    return panel


@router.delete("/panels/{panel_id}", status_code=204)
def delete_panel(panel_id: int, db: Session = Depends(get_db)) -> None:
    panel = db.get(models.Panel, panel_id)
    if not panel:
        raise HTTPException(404, "Panel not found")
    db.delete(panel)
    db.commit()
