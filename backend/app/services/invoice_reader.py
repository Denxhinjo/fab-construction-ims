"""
Turns an uploaded invoice file into plain text lines for invoice_parser.

  * Digital PDF (exported from invoicing software): the PDF's own text layer
    is used. Words are regrouped into visual rows by their position, because
    the text layer's order often runs column by column instead of row by row.
  * Scanned PDF (CamScanner etc.) or photo (JPEG/PNG): Tesseract OCR with the
    Albanian + English language data. Needs the `tesseract` binary on the
    server (see backend/Dockerfile); without it these files are marked as
    unreadable and can still be entered by hand.
"""
from __future__ import annotations

import io
import os
import shutil
from dataclasses import dataclass
from statistics import median

from ..config import settings

PDF_MAGIC = b"%PDF"
IMAGE_MAGIC = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")
MAX_PAGES = 5
OCR_DPI = 300
# A page with fewer letters/digits than this in its text layer is a scan
# (CamScanner adds just its own name, for instance).
MIN_TEXT_CHARS = 40


class UnsupportedFile(Exception):
    pass


class OcrUnavailable(Exception):
    pass


@dataclass
class ReadResult:
    text: str
    used_ocr: bool


def detect_kind(data: bytes) -> str | None:
    if data.startswith(PDF_MAGIC):
        return "pdf"
    if any(data.startswith(m) for m in IMAGE_MAGIC):
        return "image"
    return None


def read_document(data: bytes) -> ReadResult:
    kind = detect_kind(data)
    if kind == "pdf":
        return _read_pdf(data)
    if kind == "image":
        from PIL import Image, ImageOps

        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        return ReadResult(text=_ocr(image), used_ocr=True)
    raise UnsupportedFile("Only PDF, JPEG and PNG files are accepted.")


# ─── PDF ──────────────────────────────────────────────────────────────────────
def _read_pdf(data: bytes) -> ReadResult:
    import fitz  # PyMuPDF

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # corrupt or encrypted
        raise UnsupportedFile("The PDF could not be opened.") from exc

    pages = [doc[i] for i in range(min(len(doc), MAX_PAGES))]
    texts = [_page_text(page) for page in pages]
    if all(sum(c.isalnum() for c in t) >= MIN_TEXT_CHARS for t in texts):
        return ReadResult(text="\n".join(texts), used_ocr=False)

    from PIL import Image

    ocr_texts = []
    for page, text in zip(pages, texts):
        if sum(c.isalnum() for c in text) >= MIN_TEXT_CHARS:
            ocr_texts.append(text)
            continue
        pix = page.get_pixmap(dpi=OCR_DPI)
        image = Image.frombytes("RGB" if pix.n < 4 else "RGBA", (pix.width, pix.height), pix.samples)
        ocr_texts.append(_ocr(image))
    return ReadResult(text="\n".join(ocr_texts), used_ocr=True)


def _page_text(page) -> str:
    """Rebuild visual rows from word boxes: words whose vertical centres are
    within half a line height of each other belong to the same row."""
    words = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, word_no)
    if not words:
        return ""
    height = median(w[3] - w[1] for w in words) or 1
    words = sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0]))
    rows: list[list[tuple]] = []
    row_y = None
    for w in words:
        y = (w[1] + w[3]) / 2
        if row_y is None or abs(y - row_y) > height * 0.5:
            rows.append([w])
            row_y = y
        else:
            rows[-1].append(w)
    return "\n".join(" ".join(w[4] for w in sorted(row, key=lambda w: w[0])) for row in rows)


# ─── OCR ──────────────────────────────────────────────────────────────────────
def ocr_available() -> bool:
    if settings.TESSERACT_CMD:
        return os.path.isfile(settings.TESSERACT_CMD)
    return bool(shutil.which("tesseract"))


def _ocr(image) -> str:
    if not ocr_available():
        raise OcrUnavailable("Tesseract OCR is not installed on the server.")
    import pytesseract
    from PIL import ImageOps

    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    image = ImageOps.grayscale(image)
    # Phone photos are often small after messaging apps recompress them;
    # Tesseract reads best at roughly 300 dpi, i.e. ~2500 px across a page.
    longest = max(image.size)
    if longest < 2000:
        scale = 2500 / longest
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    image = _upright(image, pytesseract)

    available = set(pytesseract.get_languages(config=""))
    langs = "+".join(l for l in settings.OCR_LANGUAGES.split("+") if l in available) or "eng"
    # psm 6 = "a single uniform block of text": keeps each table row on one
    # line, which is what the row parser needs.
    return pytesseract.image_to_string(image, lang=langs, config="--psm 6")


def _upright(image, pytesseract):
    """Rotate photos taken sideways or upside down. Orientation detection
    needs the 'osd' language data; if it's missing, or the page has too
    little text to judge, the image is used as is."""
    try:
        osd = pytesseract.image_to_osd(image, output_type=pytesseract.Output.DICT)
    except Exception:
        return image
    angle = int(osd.get("rotate", 0) or 0)
    if angle and float(osd.get("orientation_conf", 0)) >= 2:
        return image.rotate(-angle, expand=True, fillcolor=255)
    return image
