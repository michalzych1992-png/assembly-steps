"""PDF report for one assembly task (all stages + photos). Pure sync — call via asyncio.to_thread."""
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List
from zoneinfo import ZoneInfo

from PIL import Image as PILImage
from reportlab.graphics import renderPDF
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from svglib.svglib import svg2rlg

ASSETS = Path(__file__).parent.parent / "assets"
FONT_DIR = ASSETS / "fonts"
pdfmetrics.registerFont(TTFont("LS", str(FONT_DIR / "LiberationSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("LS-B", str(FONT_DIR / "LiberationSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("LS-I", str(FONT_DIR / "LiberationSans-Italic.ttf")))
pdfmetrics.registerFontFamily("LS", normal="LS", bold="LS-B", italic="LS-I", boldItalic="LS-B")

RED = colors.HexColor("#CF212B")
DARK = colors.HexColor("#1F242C")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")
TZ = ZoneInfo("Europe/Warsaw")

STAGE_LABELS = {
    "produkcja": "Produkcja",
    "pakowanie": "Pakowanie",
    "dostawa_rozladunek": "Dostawa i rozładunek",
    "montaz": "Montaż",
}
STATUS_LABELS = {"nie_rozpoczety": "Nie rozpoczęty", "w_trakcie": "W trakcie", "ukonczony": "Ukończony"}
STATUS_COLORS = {
    "nie_rozpoczety": colors.HexColor("#6B7280"),
    "w_trakcie": colors.HexColor("#D97706"),
    "ukonczony": colors.HexColor("#059669"),
}

S = {
    "h1": ParagraphStyle("h1", fontName="LS-B", fontSize=18, leading=22, textColor=DARK),
    "h2": ParagraphStyle("h2", fontName="LS-B", fontSize=13, leading=16, textColor=DARK),
    "body": ParagraphStyle("body", fontName="LS", fontSize=9.5, leading=13, textColor=DARK, alignment=TA_LEFT),
    "small": ParagraphStyle("small", fontName="LS", fontSize=8, leading=10.5, textColor=MUTED),
    "label": ParagraphStyle("label", fontName="LS-B", fontSize=8, leading=10, textColor=MUTED),
    "kicker": ParagraphStyle("kicker", fontName="LS-B", fontSize=8, leading=10, textColor=RED),
}


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")


def _fmt_dt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ).strftime("%d.%m.%Y, %H:%M")


def _fmt_date(iso: str) -> str:
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return iso


def _logo(width: float):
    d = svg2rlg(str(ASSETS / "wimed-logo.svg"))
    scale = width / d.width
    d.width, d.height = d.width * scale, d.height * scale
    d.scale(scale, scale)
    return d


def _photo_flowable(data: bytes, max_w: float, max_h: float):
    img = PILImage.open(io.BytesIO(data))
    img = img.convert("RGB")
    img.thumbnail((1200, 1200))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=78)
    buf.seek(0)
    w, h = img.size
    ratio = min(max_w / w, max_h / h)
    return Image(buf, width=w * ratio, height=h * ratio)


def _status_chip(status: str) -> Table:
    t = Table([[Paragraph(STATUS_LABELS[status].upper(), ParagraphStyle(
        "chip", fontName="LS-B", fontSize=7.5, leading=9, textColor=colors.white))]])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), STATUS_COLORS[status]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def build_task_pdf(task: dict, photos: List[dict], files: Dict[str, bytes], progress: int) -> bytes:
    buf = io.BytesIO()
    page_w, page_h = A4
    margin = 16 * mm
    content_w = page_w - 2 * margin - 12  # SimpleDocTemplate frame has 6pt padding each side
    generated = _fmt_dt(datetime.now(timezone.utc))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(RED)
        canvas.rect(0, page_h - 4, page_w, 4, stroke=0, fill=1)
        renderPDF.draw(_logo(28 * mm), canvas, margin, page_h - 14 * mm)
        canvas.setFont("LS", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(page_w - margin, page_h - 11 * mm, "Raport zadania montażowego")
        canvas.setStrokeColor(LINE)
        canvas.line(margin, 12 * mm, page_w - margin, 12 * mm)
        canvas.drawString(margin, 8 * mm, f"WIMED · wygenerowano {generated}")
        canvas.drawRightString(page_w - margin, 8 * mm, f"Strona {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=margin, rightMargin=margin, topMargin=22 * mm, bottomMargin=18 * mm,
        title=f"Raport – {task['nazwa']}", author="WIMED",
    )
    story: list = [
        Paragraph("ZADANIE MONTAŻOWE", S["kicker"]),
        Spacer(1, 3),
        Paragraph(_esc(task["nazwa"]), S["h1"]),
        Spacer(1, 8),
    ]

    info_rows = [
        [Paragraph("KLIENT", S["label"]), Paragraph(_esc(task["klient"]), S["body"]),
         Paragraph("TERMIN", S["label"]), Paragraph(_fmt_date(task["termin"]), S["body"])],
        [Paragraph("ADRES MONTAŻU", S["label"]), Paragraph(_esc(task["adres"]), S["body"]),
         Paragraph("POSTĘP", S["label"]), Paragraph(f"<b>{progress}%</b>", S["body"])],
    ]
    info = Table(info_rows, colWidths=[28 * mm, content_w - 28 * mm - 22 * mm - 30 * mm, 22 * mm, 30 * mm])
    info.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [info]
    if task.get("opis"):
        story += [Spacer(1, 6), Paragraph("OPIS", S["label"]), Spacer(1, 2), Paragraph(_esc(task["opis"]), S["body"])]

    # Stage summary table
    story += [Spacer(1, 12), Paragraph("Podsumowanie etapów", S["h2"]), Spacer(1, 6)]
    counts = {k: 0 for k in STAGE_LABELS}
    for p in photos:
        counts[p["stage"]] = counts.get(p["stage"], 0) + 1
    rows = [[Paragraph("ETAP", S["label"]), Paragraph("STATUS", S["label"]), Paragraph("ZDJĘCIA", S["label"])]]
    for i, (sid, label) in enumerate(STAGE_LABELS.items(), 1):
        rows.append([Paragraph(f"{i}. {label}", S["body"]), _status_chip(task["stages"].get(sid, "nie_rozpoczety")),
                     Paragraph(str(counts.get(sid, 0)), S["body"])])
    summary = Table(rows, colWidths=[content_w * 0.5, content_w * 0.3, content_w * 0.2])
    summary.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(summary)

    # Per-stage photo documentation, 2 columns
    col_gap = 6 * mm
    col_w = (content_w - col_gap) / 2
    for i, (sid, label) in enumerate(STAGE_LABELS.items(), 1):
        stage_photos = sorted([p for p in photos if p["stage"] == sid], key=lambda p: p["created_at"])
        status = task["stages"].get(sid, "nie_rozpoczety")
        head = Table([[Paragraph(f"{i}. {label}", S["h2"]), _status_chip(status)]],
                     colWidths=[content_w - 35 * mm, 35 * mm])
        head.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, 0), 1.2, RED),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story += [CondPageBreak(60 * mm), Spacer(1, 16), head, Spacer(1, 8)]
        if not stage_photos:
            story.append(Paragraph("Brak zdjęć dla tego etapu.", S["small"]))
            continue
        cells = []
        for p in stage_photos:
            data = files.get(p["id"])
            parts: list = []
            if data:
                try:
                    parts.append(_photo_flowable(data, col_w, 62 * mm))
                except Exception:
                    parts.append(Paragraph("[nie można odczytać zdjęcia]", S["small"]))
            parts += [
                Spacer(1, 4),
                Paragraph(_esc(p["description"]), S["body"]),
                Paragraph(f"{_esc(p['author'])} · dodano {_fmt_dt(p['created_at'])}", S["small"]),
            ]
            cells.append(parts)
        if len(cells) % 2:
            cells.append([Spacer(1, 1)])
        for j in range(0, len(cells), 2):
            row = Table([[cells[j], cells[j + 1]]], colWidths=[col_w + col_gap / 2, col_w + col_gap / 2])
            row.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), col_gap / 2),
                ("LEFTPADDING", (1, 0), (1, 0), col_gap / 2), ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]))
            story.append(KeepTogether(row))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()
