"""Translation bridge CLI.

This is how Claude (in Claude Code) participates in the *hybrid* workflow:
the web app stores books, pages, and page images; this CLI reads what needs
translating and writes panel translations + glossary entries back into the
same SQLite database the API serves from.

Typical loop:
    uv run cli.py pending                 # what needs translating?
    uv run cli.py page 7                  # show page 7 + its series glossary;
                                          #   prints the absolute image path to read
    uv run cli.py import-page 7 work.json # write all panels for the page at once
    uv run cli.py add-term 3 --term 鬼 --reading おに --meaning demon --type vocab

`import-page` is the fast path: produce one JSON file describing every panel on
the page and import it in a single call. Re-importing a page replaces its panels,
so revising earlier translations once more context is known is just another import.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from app.config import IMAGES_DIR
from app.database import SessionLocal, init_db
from app import models

app = typer.Typer(add_completion=False, help="Manga translation bridge.")
console = Console()

PENDING_STATES = ("untranslated", "in_progress", "needs_review")


def _abs_image(rel: str | None) -> str | None:
    return str((IMAGES_DIR / rel).resolve()) if rel else None


def _series_for_page(db, page: models.Page) -> models.Series | None:
    """Resolve a page's series via its entry, or the book's series fallback."""
    if page.entry and page.entry.series:
        return page.entry.series
    if page.book and page.book.series:
        return page.book.series
    return None


@app.command()
def pending() -> None:
    """List pages that still need translation work."""
    init_db()
    with SessionLocal() as db:
        pages = (
            db.query(models.Page)
            .filter(models.Page.status.in_(PENDING_STATES))
            .order_by(models.Page.book_id, models.Page.page_number)
            .all()
        )
        if not pages:
            console.print("[green]Nothing pending — all caught up.[/green]")
            return
        table = Table(title="Pages needing translation")
        table.add_column("page_id", justify="right")
        table.add_column("book")
        table.add_column("series")
        table.add_column("pg#", justify="right")
        table.add_column("panels", justify="right")
        table.add_column("status")
        table.add_column("image")
        for p in pages:
            series = _series_for_page(db, p)
            series_name = (
                series.title_romaji or series.title_native if series else "—"
            )
            table.add_row(
                str(p.id),
                p.book.title if p.book else "—",
                series_name or "—",
                str(p.page_number),
                str(p.panel_count),
                p.status,
                _abs_image(p.image_path) or "(no image)",
            )
        console.print(table)


@app.command()
def page(page_id: int) -> None:
    """Show a page: its image path, series glossary, and existing panels."""
    init_db()
    with SessionLocal() as db:
        p = db.get(models.Page, page_id)
        if not p:
            console.print(f"[red]Page {page_id} not found.[/red]")
            raise typer.Exit(1)
        series = _series_for_page(db, p)
        info = {
            "page_id": p.id,
            "book": p.book.title if p.book else None,
            "book_kind": p.book.kind if p.book else None,
            "page_number": p.page_number,
            "panel_count": p.panel_count,
            "status": p.status,
            "reading_order": p.reading_order,
            "image_path": _abs_image(p.image_path),
            "series_id": series.id if series else None,
            "series": (series.title_romaji or series.title_native) if series else None,
        }
        console.print_json(data=info)

        if series and series.glossary:
            table = Table(title=f"Glossary — {info['series']}")
            for col in ("id", "term", "reading", "meaning", "type"):
                table.add_column(col)
            for t in series.glossary:
                table.add_row(
                    str(t.id), t.term, t.reading or "", t.meaning or "", t.type
                )
            console.print(table)

        if p.panels:
            table = Table(title="Existing panels")
            for col in ("idx", "type", "speaker", "jp", "translation"):
                table.add_column(col)
            for pan in p.panels:
                table.add_row(
                    str(pan.panel_index),
                    pan.panel_type,
                    pan.speaker or "",
                    (pan.original_text or "")[:30],
                    (pan.translation or "")[:40],
                )
            console.print(table)


@app.command(name="image")
def image_path(page_id: int) -> None:
    """Print the absolute image path for a page (for reading the page image)."""
    init_db()
    with SessionLocal() as db:
        p = db.get(models.Page, page_id)
        if not p or not p.image_path:
            console.print("[red]No image for that page.[/red]")
            raise typer.Exit(1)
        print(_abs_image(p.image_path))


@app.command(name="import-page")
def import_page(
    page_id: int,
    json_file: str = typer.Argument(..., help="Path to JSON, or '-' for stdin."),
) -> None:
    """Replace a page's panels from a JSON file (the fast path).

    JSON shape:
        {
          "panel_count": 4,
          "status": "translated",
          "notes": "optional page-level note",
          "panels": [
            {
              "panel_index": 1,
              "panel_type": "dialogue",
              "speaker": "Tanjiro",
              "original_text": "鬼を倒す！",
              "reading": "おにをたおす！",
              "romaji": "Oni o taosu!",
              "translation": "I'll defeat the demons!",
              "literal": "demon(OBJ) defeat",
              "notes": "を marks the direct object; 倒す = to defeat.",
              "confidence": "high",
              "needs_context": false
            }
          ]
        }
    """
    init_db()
    raw = sys.stdin.read() if json_file == "-" else Path(json_file).read_text()
    data = json.loads(raw)
    panels = data.get("panels", [])

    with SessionLocal() as db:
        p = db.get(models.Page, page_id)
        if not p:
            console.print(f"[red]Page {page_id} not found.[/red]")
            raise typer.Exit(1)

        for existing in list(p.panels):  # replace; re-import = revise
            db.delete(existing)
        db.flush()

        allowed = {
            "panel_index", "panel_type", "speaker", "original_text", "reading",
            "romaji", "translation", "literal", "notes", "bbox",
            "needs_context", "confidence",
        }
        for pan in panels:
            db.add(models.Panel(page_id=page_id, **{k: v for k, v in pan.items() if k in allowed}))

        p.panel_count = data.get("panel_count", len(panels))
        p.status = data.get("status", "translated")
        if "notes" in data:
            p.notes = data["notes"]
        db.commit()
        console.print(
            f"[green]Imported {len(panels)} panel(s) to page {page_id}; "
            f"status={p.status}, panel_count={p.panel_count}.[/green]"
        )


@app.command(name="set-panel")
def set_panel(
    page_id: int,
    panel_index: int,
    type: str = "dialogue",
    speaker: str = typer.Option(None),
    jp: str = typer.Option(None, help="original Japanese text"),
    reading: str = typer.Option(None),
    romaji: str = typer.Option(None),
    tl: str = typer.Option(None, help="translation"),
    literal: str = typer.Option(None),
    notes: str = typer.Option(None),
    confidence: str = typer.Option(None),
    needs_context: bool = typer.Option(False),
) -> None:
    """Upsert a single panel by (page, index). Handy for one-off fixes."""
    init_db()
    with SessionLocal() as db:
        p = db.get(models.Page, page_id)
        if not p:
            console.print(f"[red]Page {page_id} not found.[/red]")
            raise typer.Exit(1)
        panel = next((x for x in p.panels if x.panel_index == panel_index), None)
        if panel is None:
            panel = models.Panel(page_id=page_id, panel_index=panel_index)
            db.add(panel)
        panel.panel_type = type
        for attr, val in (
            ("speaker", speaker), ("original_text", jp), ("reading", reading),
            ("romaji", romaji), ("translation", tl), ("literal", literal),
            ("notes", notes), ("confidence", confidence),
        ):
            if val is not None:
                setattr(panel, attr, val)
        panel.needs_context = needs_context
        p.panel_count = max(p.panel_count, panel_index)
        db.commit()
        console.print(f"[green]Saved panel {panel_index} on page {page_id}.[/green]")


@app.command(name="set-status")
def set_status(page_id: int, status: str) -> None:
    """Set a page's status (untranslated|in_progress|translated|needs_review)."""
    init_db()
    with SessionLocal() as db:
        p = db.get(models.Page, page_id)
        if not p:
            console.print(f"[red]Page {page_id} not found.[/red]")
            raise typer.Exit(1)
        p.status = status
        db.commit()
        console.print(f"[green]Page {page_id} status -> {status}.[/green]")


@app.command()
def glossary(series_id: int) -> None:
    """List the glossary for a series."""
    init_db()
    with SessionLocal() as db:
        s = db.get(models.Series, series_id)
        if not s:
            console.print(f"[red]Series {series_id} not found.[/red]")
            raise typer.Exit(1)
        if not s.glossary:
            console.print("[yellow]No glossary terms yet.[/yellow]")
            return
        table = Table(title=f"Glossary — {s.title_romaji or s.title_native}")
        for col in ("id", "term", "reading", "romaji", "meaning", "type", "notes"):
            table.add_column(col)
        for t in s.glossary:
            table.add_row(
                str(t.id), t.term, t.reading or "", t.romaji or "",
                t.meaning or "", t.type, (t.notes or "")[:40],
            )
        console.print(table)


@app.command(name="add-term")
def add_term(
    series_id: int,
    term: str = typer.Option(..., help="Japanese term"),
    reading: str = typer.Option(None),
    romaji: str = typer.Option(None),
    meaning: str = typer.Option(None),
    type: str = typer.Option("vocab", help="character|place|phrase|vocab|grammar|sfx"),
    notes: str = typer.Option(None),
) -> None:
    """Add a glossary term to a series."""
    init_db()
    with SessionLocal() as db:
        s = db.get(models.Series, series_id)
        if not s:
            console.print(f"[red]Series {series_id} not found.[/red]")
            raise typer.Exit(1)
        db.add(models.GlossaryTerm(
            series_id=series_id, term=term, reading=reading, romaji=romaji,
            meaning=meaning, type=type, notes=notes,
        ))
        db.commit()
        console.print(f"[green]Added term '{term}' to series {series_id}.[/green]")


@app.command(name="set-bboxes")
def set_bboxes(
    page_id: int,
    json_file: str = typer.Argument(..., help="Path to JSON, or '-' for stdin."),
) -> None:
    """Set per-panel bounding boxes for a page (for panel-focus zoom in the reader).

    Coordinates are normalized 0..1 relative to the page image: [x, y, w, h]
    where (x, y) is the top-left corner and (w, h) the width/height.

    Accepts either form:
        {"1": [0.05, 0.04, 0.4, 0.3], "2": [...]}
        [{"panel_index": 1, "bbox": [0.05, 0.04, 0.4, 0.3]}, ...]
    """
    raw = sys.stdin.read() if json_file == "-" else Path(json_file).read_text()
    data = json.loads(raw)
    if isinstance(data, list):
        mapping = {str(d["panel_index"]): d["bbox"] for d in data}
    else:
        mapping = {str(k): v for k, v in data.items()}

    init_db()
    with SessionLocal() as db:
        page = db.get(models.Page, page_id)
        if not page:
            console.print(f"[red]Page {page_id} not found.[/red]")
            raise typer.Exit(1)
        n = 0
        for panel in page.panels:
            bbox = mapping.get(str(panel.panel_index))
            if bbox is not None:
                panel.bbox = json.dumps(bbox)
                n += 1
        db.commit()
        console.print(f"[green]Set bbox on {n}/{len(page.panels)} panels of page {page_id}.[/green]")


@app.command(name="import-pdf")
def import_pdf(
    pdf_path: str,
    title: str = typer.Option(None, help="Book title (default: from filename)"),
    kind: str = typer.Option("magazine", help="volume|magazine|anthology|other"),
    max_width: int = typer.Option(1800, help="Max page-image width in px"),
    dpi: int = typer.Option(200, help="Render DPI"),
) -> None:
    """Import a PDF you own as a book — render each page to a stored image.

    Creates a Book and one untranslated Page per PDF page (images go to
    data/images/pages). Translate afterwards with import-page, as usual.
    """
    import io
    from pathlib import Path

    import fitz  # PyMuPDF
    from PIL import Image

    from app.config import PAGES_DIR

    init_db()
    p = Path(pdf_path)
    if not p.exists():
        console.print(f"[red]File not found: {pdf_path}[/red]")
        raise typer.Exit(1)

    book_title = title or p.stem
    doc = fitz.open(pdf_path)
    n = doc.page_count
    with SessionLocal() as db:
        book = models.Book(kind=kind, title=book_title)
        db.add(book)
        db.commit()
        db.refresh(book)
        for i in range(n):
            pix = doc.load_page(i).get_pixmap(dpi=dpi)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            if img.width > max_width:
                ratio = max_width / img.width
                img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
            dest = PAGES_DIR / f"book-{book.id}-page-{i + 1}.jpg"
            img.convert("RGB").save(dest, "JPEG", quality=85)
            db.add(models.Page(
                book_id=book.id, page_number=i + 1,
                image_path=f"pages/book-{book.id}-page-{i + 1}.jpg",
                status="untranslated",
            ))
            if (i + 1) % 25 == 0:
                console.print(f"  …rendered {i + 1}/{n}")
        db.commit()
        book_id = book.id  # capture before the session closes (avoids DetachedInstanceError)
    console.print(
        f"[green]Imported '{book_title}' as book {book_id} with {n} pages "
        f"(kind={kind}).[/green]"
    )


if __name__ == "__main__":
    app()
