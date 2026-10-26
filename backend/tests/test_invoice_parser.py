from datetime import date
from pathlib import Path

import pytest

from app.services.invoice_parser import (
    INV_TOTALS_COMPUTED, ROW_ARITHMETIC, ROW_UNIT_UNKNOWN,
    parse_invoice, parse_number,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize("token, expected", [
    ("16,733.33", 16733.33),
    ("16.733,33", 16733.33),
    ("20.9167", 20.9167),
    ("20,9167", 20.9167),
    ("1,450.00", 1450.0),
    ("70,190", 70190.0),
    ("134,308", 134308.0),
    ("800:", 800.0),
    ("16,733.33.", 16733.33),
    ("0.85", 0.85),
    ("0,850", 0.85),
    ("1.234.567", 1234567.0),
    ("abc", None),
    ("=", None),
])
def test_parse_number(token, expected):
    assert parse_number(token) == expected


@pytest.mark.parametrize("fixture", [
    "scanned_fiscal_invoice_ocr.txt",             # Tesseract 5.3 (Debian, the server image)
    "scanned_fiscal_invoice_ocr_tesseract55.txt",  # Tesseract 5.5 (Windows), stray dashes between numbers
])
def test_scanned_fiscal_invoice_from_ocr(fixture):
    """Real Tesseract output of a phone-scanned Albanian fiscal invoice, with
    its OCR damage left in (a dropped decimal point, junk before a row, a
    misread NIPT). Names, tax numbers and fiscal codes are replaced with
    fictional ones; the layout and numbers are untouched."""
    inv = parse_invoice((FIXTURES / fixture).read_text(encoding="utf-8"))

    assert inv.invoice_number == "523"
    assert inv.invoice_date == date(2026, 10, 8)
    assert inv.supplier_name == "Elektro Drita"
    assert inv.supplier_tax_number == "M01234567E"  # OCR read "MO1234567..."
    assert inv.currency == "ALL"
    assert (inv.subtotal, inv.vat_total, inv.total) == (111923.33, 22384.67, 134308.0)
    assert inv.issues == []

    assert [(r.quantity, r.unit_price, r.net_amount, r.gross_amount) for r in inv.lines] == [
        (800, 20.9167, 16733.33, 20080),
        (600, 116.9833, 70190, 84228),   # printed price OCR'd as "1169833"
        (50, 500, 25000, 30000),
    ]
    assert [r.unit for r in inv.lines] == ["m", "m", "copë"]
    assert inv.lines[2].code == "A125"
    assert "Bashkues elektrik" in inv.lines[2].description
    assert all(r.confidence == "ok" for r in inv.lines)


DIGITAL_SQ = """
BETON-MIX SH.P.K.
NIPT: K12345678L
FATURË
Nr. FAT-2026-0421
Data: 26.10.2026
Blerësi: Fab Construction  NIPT L00000000A
# Përshkrimi Sasia Njs. Çmimi Vlera
1 Cimento CEM II/B-M 42.5R 25kg 200 thes 6.35 1,270.00
2 Llac ngjites C1 25kg 80 thes 7.10 568.00
3 Blloqe betoni 20x25x50 600 cope 0.85 510.00
4 Transport deri ne depo 1 150.00 150.00
Nëntotali: 2,498.00 €
TVSH 18%: 449.64 €
TOTALI: 2,947.64 €
"""


def test_digital_invoice_with_unit_before_quantity():
    inv = parse_invoice(DIGITAL_SQ)
    assert inv.invoice_number == "FAT-2026-0421"
    assert inv.invoice_date == date(2026, 10, 26)
    assert inv.supplier_tax_number == "K12345678L"  # the seller's, not the buyer's
    assert inv.currency == "EUR"
    assert (inv.subtotal, inv.vat_total, inv.total) == (2498.0, 449.64, 2947.64)
    assert len(inv.lines) == 4
    cement = inv.lines[0]
    assert (cement.quantity, cement.unit_price, cement.net_amount) == (200, 6.35, 1270)
    assert cement.description == "Cimento CEM II/B-M 42.5R 25kg"
    assert inv.lines[3].kind == "extra"  # transport is a cost, not stock


ENGLISH = """
INVOICE
Supplier: Metal-Kos Ltd
Invoice No: INV-778
Invoice Date: 2026-10-25
Code Description Qty Unit Price Amount VAT Total
HEK-012 Rebar 12mm 12m 60 pcs 14.90 894.00 178.80 1,072.80
RRJ-188 Mesh Q188 20 pcs 38.00 760.00 152.00 912.00
Total EUR 1,654.00 330.80 1,984.80
"""


def test_english_invoice():
    inv = parse_invoice(ENGLISH)
    assert inv.invoice_number == "INV-778"
    assert inv.invoice_date == date(2026, 10, 25)
    assert inv.supplier_name == "Metal-Kos Ltd"
    assert inv.total == 1984.80 and inv.subtotal == 1654.0
    assert [(r.code, r.quantity, r.unit) for r in inv.lines] == [("HEK-012", 60, "copë"), ("RRJ-188", 20, "copë")]
    assert all(r.confidence == "ok" for r in inv.lines)


def test_row_that_does_not_add_up_needs_checking():
    text = """Pershkrimi Sasia Cmimi Vlera
1 Gips karton 12.5mm copë 10 5.20 99.00
TOTALI 99.00"""
    row = parse_invoice(text).lines[0]
    assert ROW_ARITHMETIC in row.issues
    assert row.confidence == "check"


def test_unknown_unit_needs_checking():
    text = """Pershkrimi Sasia Cmimi Vlera
1 Rrjete fasade 145g 4 rol50m2 4 42.00 168.00"""
    row = parse_invoice(text).lines[0]
    assert ROW_UNIT_UNKNOWN in row.issues
    assert row.confidence == "check"


def test_totals_computed_from_rows_when_missing():
    text = """Pershkrimi Njesia Sasia Cmimi Vlera
1 Rere lumi m3 10 22.00 220.00"""
    inv = parse_invoice(text)
    assert inv.total == 220.0
    assert INV_TOTALS_COMPUTED in inv.issues


def test_ocr_slashes_read_as_ones_in_date():
    assert parse_invoice("Data 0811012026").invoice_date == date(2026, 10, 8)


def test_wrapped_description_joins_previous_row():
    text = """Pershkrimi Njesia Sasia Cmimi Vlera
1 Hidroizolim bitumi me fibra kove 12 28.50 342.00
per tarraca
TOTALI 342.00"""
    row = parse_invoice(text).lines[0]
    assert row.description == "Hidroizolim bitumi me fibra per tarraca"
    assert row.unit == "kovë"
