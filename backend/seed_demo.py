"""Seed a throwaway DEMO library with synthetic, copyright-free content.

Run against a scratch data dir so it never touches your real library:

    MANGA_DATA_DIR=/tmp/manga_demo uv run python seed_demo.py

It draws placeholder cover + page images (plain shapes — no real manga) and
creates a demo series/book/pages/panels with fake text and panel zoom-regions.
Handy for trying the app or taking UI screenshots without any real content.
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from app.config import COVERS_DIR, PAGES_DIR
from app.database import SessionLocal, engine, init_db
from app import models

INK = (30, 33, 40)
PAPER = (247, 246, 242)
ACCENT = (224, 64, 94)


def _lines(draw, x, y, w, n, gap=16, ink=INK):
    """Fake text as short horizontal strokes (avoids font/glyph issues)."""
    for i in range(n):
        ln = int(w * (0.9 if i < n - 1 else 0.55))
        draw.line([(x, y + i * gap), (x + ln, y + i * gap)], fill=ink, width=3)


def _bubble(draw, cx, cy, rw, rh, textlines=3):
    draw.ellipse([cx - rw, cy - rh, cx + rw, cy + rh], fill=(255, 255, 255), outline=INK, width=4)
    _lines(draw, cx - rw * 0.55, cy - rh * 0.45, rw * 1.1, textlines, gap=int(rh / 4))


def make_page(path, label):
    img = Image.new("RGB", (800, 1200), PAPER)
    d = ImageDraw.Draw(img)
    # two stacked panels
    d.rectangle([24, 24, 776, 588], outline=INK, width=5)
    d.rectangle([24, 612, 776, 1176], outline=INK, width=5)
    # simple "art": a horizon + sun in top panel, a figure box in bottom
    d.line([(40, 470), (760, 470)], fill=INK, width=3)
    d.ellipse([560, 90, 700, 230], outline=INK, width=4)
    _bubble(d, 250, 190, 150, 95, 3)
    d.rectangle([300, 700, 500, 1120], outline=INK, width=4)  # a "character"
    _bubble(d, 560, 780, 160, 100, 4)
    d.text((36, 1150), f"DEMO PAGE {label} — synthetic placeholder, no real content", fill=ACCENT)
    img.save(path, "JPEG", quality=88)


def make_cover(path):
    img = Image.new("RGB", (400, 600), PAPER)
    d = ImageDraw.Draw(img)
    for y in range(600):  # vertical gradient
        t = y / 600
        d.line([(0, y), (400, y)], fill=(int(30 + 40 * t), int(33 + 30 * t), int(46 + 60 * t)))
    d.rectangle([30, 30, 370, 570], outline=ACCENT, width=6)
    d.text((60, 260), "DEMO", fill=(255, 255, 255))
    d.text((60, 300), "SERIES", fill=(255, 255, 255))
    img.save(path, "JPEG", quality=90)


def main():
    init_db()
    # fresh demo: clear any prior rows
    with engine.begin() as conn:
        for t in ("panels", "glossary", "pages", "entries", "books", "series"):
            conn.exec_driver_sql(f"DELETE FROM {t}")

    make_cover(COVERS_DIR / "series-demo.jpg")
    make_page(PAGES_DIR / "demo-p1.jpg", "1")
    make_page(PAGES_DIR / "demo-p2.jpg", "2")

    top = [0.03, 0.02, 0.94, 0.47]
    bot = [0.03, 0.51, 0.94, 0.47]
    pages_data = [
        (1, "demo-p1.jpg", [
            ("dialogue", "主人公", "これはデモパネルです。", "This is a demo panel.",
             "Placeholder used only for screenshots.", top),
            ("narration", None, "著作権のある内容は含まれていません。",
             "No copyrighted content is included here.", "All art is drawn placeholder shapes.", bot),
        ]),
        (2, "demo-p2.jpg", [
            ("dialogue", "友達", "パネルごとにズームします。", "It zooms panel by panel.",
             "〜ごとに = 'for each / per ~'.", top),
            ("dialogue", "主人公", "文字が大きく読めるね！", "The text is nice and big!",
             "読める = potential form of 読む (to be able to read).", bot),
        ]),
    ]

    with SessionLocal() as db:
        s = models.Series(
            title_romaji="Demo Series", title_native="デモシリーズ", title_english="Demo Series",
            source="manual", author="Placeholder", status="reading", year=2026,
            description="A synthetic demo library with drawn placeholder pages — no real manga.",
            cover_path="covers/series-demo.jpg",
        )
        db.add(s); db.commit(); db.refresh(s)
        book = models.Book(kind="volume", title="Demo Volume 1", series_id=s.id, volume_number=1)
        db.add(book); db.commit(); db.refresh(book)
        entry = models.Entry(book_id=book.id, series_id=s.id, title="Chapter 1 (demo)",
                             chapter_number="1", order_index=0, start_page=1, end_page=2)
        db.add(entry); db.commit(); db.refresh(entry)
        for num, img, panels in pages_data:
            pg = models.Page(book_id=book.id, entry_id=entry.id, page_number=num,
                             image_path=f"pages/{img}", panel_count=len(panels), status="translated")
            db.add(pg); db.commit(); db.refresh(pg)
            for i, (ptype, spk, jp, tl, note, bbox) in enumerate(panels, 1):
                db.add(models.Panel(page_id=pg.id, panel_index=i, panel_type=ptype, speaker=spk,
                                    original_text=jp, translation=tl, notes=note,
                                    bbox=__import__("json").dumps(bbox), confidence="high"))
        db.add(models.GlossaryTerm(series_id=s.id, term="デモ", reading="でも", romaji="demo",
                                   meaning="demo / demonstration", type="vocab"))
        db.add(models.GlossaryTerm(series_id=s.id, term="読める", reading="よめる", romaji="yomeru",
                                   meaning="to be able to read (potential of 読む)", type="grammar"))
        db.commit()
    print("Demo library seeded.")


if __name__ == "__main__":
    main()
