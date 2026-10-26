"""
Rule-based reader for supplier invoices.

Input is plain text, one physical line of the document per line, from either
a PDF's text layer or OCR (see invoice_reader). Output is the invoice header
plus one ParsedLine per item row.

No guessing model is involved. Every value comes from a label we recognise
(Albanian or English) or from the position of a number in an item row, and
every row is checked with arithmetic:

    quantity x unit price ~= net        net + VAT ~= gross

Those checks are also what repairs OCR damage: a unit price whose decimal
point was lost ("1169833" for 116.9833) is rebuilt from net / quantity, and
a row only counts as read with certainty ("ok") when its numbers agree.
Anything that doesn't add up is marked "check" for a person to look at.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from itertools import combinations
from typing import Optional

# ─── Issue codes ──────────────────────────────────────────────────────────────
# Row issues that need a person (confidence becomes "check")
ROW_ARITHMETIC = "arithmetic_mismatch"     # qty x price != net, and nothing could repair it
ROW_PRICE_DERIVED = "price_derived"        # price unreadable, computed as net / qty
ROW_MISSING_NUMBERS = "missing_numbers"    # fewer numbers than a row needs
ROW_UNIT_UNKNOWN = "unit_unknown"          # unit missing or not one we know
# Row notes that don't need a person
ROW_PRICE_DECIMAL = "price_decimal_restored"  # same digits as printed, decimal point put back

# Invoice-level issues
INV_NO_ROWS = "no_rows"
INV_NO_NUMBER = "no_invoice_number"
INV_NO_DATE = "no_date"
INV_NO_SUPPLIER = "no_supplier"
INV_TOTALS_COMPUTED = "totals_computed"    # totals not found; summed from the rows
INV_TOTALS_MISMATCH = "totals_mismatch"    # rows don't add up to the printed totals

ROW_BLOCKING = {ROW_ARITHMETIC, ROW_PRICE_DERIVED, ROW_MISSING_NUMBERS, ROW_UNIT_UNKNOWN}

# ─── Vocabulary ───────────────────────────────────────────────────────────────
# Unit spellings seen on Albanian and English invoices -> the unit we store.
UNITS = {
    "m": "m", "ml": "m", "mt": "m", "metra": "m", "meter": "m", "metre": "m",
    "m2": "m²", "m²": "m²", "mq": "m²", "m3": "m³", "m³": "m³", "mc": "m³",
    "kg": "kg", "kilogram": "kg", "gr": "g", "g": "g", "ton": "ton", "t": "ton",
    "l": "l", "lt": "l", "litra": "l", "liter": "l",
    "cop": "copë", "cope": "copë", "cp": "copë", "pc": "copë", "pcs": "copë",
    "piece": "copë", "pieces": "copë", "nr": "copë", "njesi": "copë", "unit": "copë",
    "thes": "thes", "thase": "thes", "bag": "thes", "bags": "thes",
    "rol": "rrotull", "role": "rrotull", "rrotull": "rrotull", "roll": "rrotull",
    "kove": "kovë", "kova": "kovë", "bucket": "kovë",
    "pako": "pako", "pack": "pako", "pkt": "pako",
    "kuti": "kuti", "box": "kuti",
    "set": "set", "pale": "palë", "pair": "palë",
    "shufer": "shufër", "shufra": "shufër", "bar": "shufër",
    "pllake": "pllakë", "pllaka": "pllakë", "sheet": "pllakë",
    "pal": "paletë", "palete": "paletë", "pallet": "paletë",
}

# Descriptions that are costs on the invoice but not stock.
EXTRA_COST_WORDS = (
    "transport", "sherbim", "service", "delivery", "dergese", "freight", "shipping",
    "montim", "instalim", "installation", "qira", "rent", "kosto shtese",
)

TABLE_HEADER_WORDS = ("pershkrim", "description", "sasia", "quantity", "qty", "njesia", "cmim", "price")
TABLE_END_WORDS = ("totali", "total", "gjithsej", "nentotali", "subtotal")

CURRENCY_PATTERNS = (
    (r"\bleke?\b|\blek\b|\ball\b", "ALL"),
    (r"\beur\b|\beuro\b|€", "EUR"),
    (r"\busd\b|\$", "USD"),
)

VAT_RATES = (0.20, 0.10, 0.06, 0.0)


# ─── Results ──────────────────────────────────────────────────────────────────
@dataclass
class ParsedLine:
    line_no: int
    description: str
    code: Optional[str] = None
    raw_unit: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    net_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    gross_amount: Optional[float] = None
    kind: str = "stock"
    issues: list[str] = field(default_factory=list)

    @property
    def confidence(self) -> str:
        return "check" if ROW_BLOCKING & set(self.issues) else "ok"


@dataclass
class ParsedInvoice:
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    supplier_name: Optional[str] = None
    supplier_tax_number: Optional[str] = None
    currency: str = "ALL"
    subtotal: Optional[float] = None
    vat_total: Optional[float] = None
    total: Optional[float] = None
    lines: list[ParsedLine] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)


# ─── Text helpers ─────────────────────────────────────────────────────────────
def fold(text: str) -> str:
    """Lowercase and strip accents so 'Përshkrimi', 'PERSHKRIMI' and the
    OCR'd 'Pershkrimi' compare equal (ë->e, ç->c)."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def _close(a: float, b: float) -> bool:
    """Equal within rounding: invoice software rounds each column separately."""
    return abs(a - b) <= max(0.05, abs(b) * 0.004)


# ─── Numbers ──────────────────────────────────────────────────────────────────
_NUM_TOKEN = re.compile(r"^-?[\d][\d.,]*$")


def _clean_token(tok: str) -> str:
    # OCR leaves column-rule debris on numbers: "800:", "16,733.33.", "|20,080"
    return tok.strip(" :;|'\"“”‘’`=_()[]{}")


def parse_number(tok: str) -> Optional[float]:
    """Parse a number in either '16,733.33' or '16.733,33' style.

    A lone separator followed by exactly three digits is read as a
    thousands separator ('1,450' -> 1450, '70.190' -> 70190) because
    invoice amounts are far more often whole thousands than 3-decimal
    values; row arithmetic catches the rare exception."""
    tok = _clean_token(tok).rstrip(".,")
    if not tok or not _NUM_TOKEN.match(tok):
        return None
    neg = tok.startswith("-")
    tok = tok.lstrip("-")
    has_comma, has_dot = "," in tok, "." in tok
    if has_comma and has_dot:
        dec = "," if tok.rfind(",") > tok.rfind(".") else "."
        thou = "." if dec == "," else ","
        tok = tok.replace(thou, "").replace(dec, ".")
    elif has_comma or has_dot:
        sep = "," if has_comma else "."
        parts = tok.split(sep)
        if len(parts) > 2 or (len(parts[-1]) == 3 and len(parts[0]) <= 3 and parts[0] != "0"):
            tok = tok.replace(sep, "")
        else:
            tok = tok.replace(sep, ".")
    try:
        value = float(tok)
    except ValueError:
        return None
    return -value if neg else value


def _digits(tok: str) -> str:
    return re.sub(r"\D", "", tok)


# ─── Item rows ────────────────────────────────────────────────────────────────
def _is_unit(tok: str) -> bool:
    return fold(_clean_token(tok)).rstrip(".") in UNITS


def _split_row(line: str) -> tuple[list[str], list[tuple[str, float]], Optional[str]]:
    """Split a row into its leading words, the run of numbers at its end, and
    a unit printed inside that run ("200 thes 6.35 1,270.00": quantity, unit,
    price, amount). A unit is only taken from inside the run while at most
    four numbers follow it; on fiscal invoices the unit comes before all five
    amount columns and is left for _parse_row to pick up."""
    tokens = [t for t in line.split() if _clean_token(t)]
    numbers: list[tuple[str, float]] = []
    unit = None
    while tokens:
        tok = tokens[-1]
        if tok.endswith("%"):  # a VAT-rate column; the rate is re-derived from amounts
            tokens.pop()
            continue
        value = parse_number(tok)
        if value is None:
            if (unit is None and 2 <= len(numbers) <= 4 and _is_unit(tok)
                    and len(tokens) > 1 and parse_number(tokens[-2]) is not None):
                unit = _clean_token(tok).rstrip(".")
                tokens.pop()
                continue
            break
        numbers.insert(0, (_clean_token(tok), value))
        tokens.pop()
    return tokens, numbers, unit


def _solve_amounts(numbers: list[tuple[str, float]], row: ParsedLine) -> int:
    """Assign quantity / price / net / VAT / gross from the numbers at the end
    of a row, preferring an assignment where the arithmetic holds. Returns
    the index of the number used as quantity; numbers before it belong to
    the description."""
    values = [v for _, v in numbers]

    def tail_after(i: int) -> None:
        rest = values[i + 1:]
        net = row.net_amount
        if len(rest) >= 2 and _close(net + rest[0], rest[1]):
            row.vat_amount, row.gross_amount = rest[0], rest[1]
        elif rest:
            for r in VAT_RATES:
                if _close(net * (1 + r), rest[-1]):
                    row.gross_amount = rest[-1]
                    row.vat_amount = round(rest[-1] - net, 2)
                    break

    # 1. Any in-order triple with qty x price == net.
    for qi, pi, ni in combinations(range(len(values)), 3):
        q, p, n = values[qi], values[pi], values[ni]
        if q > 0 and p > 0 and _close(q * p, n):
            row.quantity, row.unit_price, row.net_amount = q, p, n
            tail_after(ni)
            return qi

    # 2. Price unreadable: find net + VAT == gross, take the first number as
    #    quantity and rebuild the price from net / quantity.
    for i in range(1, len(values) - 2):
        n, v, g = values[i], values[i + 1], values[i + 2]
        if n > 0 and _close(n + v, g):
            q = values[0]
            if q <= 0:
                break
            row.quantity, row.net_amount = q, n
            row.vat_amount, row.gross_amount = v, g
            row.unit_price = round(n / q, 4)
            printed = numbers[1][0] if i >= 2 else ""
            if printed and _digits(printed).lstrip("0").startswith(
                _digits(f"{row.unit_price:.4f}").lstrip("0")[:4]
            ):
                row.issues.append(ROW_PRICE_DECIMAL)
            else:
                row.issues.append(ROW_PRICE_DERIVED)
            return 0

    # 3. Nothing adds up: fall back to column positions and ask a person.
    if len(values) >= 3:
        row.quantity, row.unit_price, row.net_amount = values[0], values[1], values[2]
        if len(values) >= 5:
            row.vat_amount, row.gross_amount = values[3], values[4]
        row.issues.append(ROW_ARITHMETIC)
    else:
        if values:
            row.quantity = values[0]
        if len(values) > 1:
            row.unit_price = values[1]
        row.issues.append(ROW_MISSING_NUMBERS)
    return 0


_ROW_NO = re.compile(r"^\d{1,3}[.)\-]?$")
_ROW_NO_JOINED = re.compile(r"^(\d{1,3})[.\-](\S+)$")   # "3-A125"
_CODE = re.compile(r"^(?=.*\d)[A-Za-z0-9][A-Za-z0-9\-./]{2,}$")


def _parse_row(text: str, line_no: int, has_code_column: bool) -> Optional[ParsedLine]:
    words, numbers, raw_unit = _split_row(text)
    if len(numbers) < 2 or not words:
        return None
    if not any(ch.isalpha() for ch in " ".join(words)):
        return None

    # Leading row number, possibly glued to the code ("3-A125").
    joined = _ROW_NO_JOINED.match(words[0])
    if joined and has_code_column:
        words = [joined.group(2)] + words[1:]
    elif _ROW_NO.match(words[0]) and len(words) > 1:
        words = words[1:]

    code = None
    if has_code_column and len(words) > 1 and _CODE.match(_clean_token(words[0])):
        code = _clean_token(words[0])
        words = words[1:]

    if raw_unit is None and len(words) > 1 and _is_unit(words[-1]):
        raw_unit = _clean_token(words[-1]).rstrip(".")
        words = words[:-1]

    row = ParsedLine(line_no=line_no, description="", code=code, raw_unit=raw_unit)
    row.unit = UNITS.get(fold(raw_unit)) if raw_unit else None
    first = _solve_amounts(numbers, row)
    # Numbers before the quantity were part of the description ("Tub PVC 110").
    words = words + [tok for tok, _ in numbers[:first]]

    # A pipe standing alone between words is OCR's reading of "I" or "l".
    row.description = " ".join("I" if w == "|" else _clean_token(w) or w for w in words).strip(" -")

    if any(word in fold(row.description) for word in EXTRA_COST_WORDS):
        row.kind = "extra"
    elif row.unit is None:
        row.issues.append(ROW_UNIT_UNKNOWN)
    return row


def _find_table(lines: list[str]) -> tuple[int, int, bool]:
    """Return (first row index, end index, has a code column)."""
    start, has_code = 0, False
    for i, line in enumerate(lines):
        f = fold(line)
        if sum(word in f for word in TABLE_HEADER_WORDS) >= 2:
            start = i + 1
            has_code = bool(re.search(r"\bkod|\bcode|\bsku|\bart", f))
            # Column titles often wrap onto a second line ("matje", "TVSH").
            if start < len(lines) and not _split_row(lines[start])[1]:
                start += 1
            break
    end = len(lines)
    for i in range(start, len(lines)):
        f = fold(lines[i])
        if any(re.search(rf"\b{word}\b", f) for word in TABLE_END_WORDS):
            end = i
            break
    return start, end, has_code


def parse_rows(lines: list[str]) -> list[ParsedLine]:
    start, end, has_code = _find_table(lines)
    rows: list[ParsedLine] = []
    for line in lines[start:end]:
        row = _parse_row(line, len(rows) + 1, has_code)
        if row is not None:
            rows.append(row)
        elif rows and not _split_row(line)[1]:
            # A description that wrapped onto the next line.
            extra = line.strip()
            if 3 <= len(extra) <= 60 and sum(c.isalpha() for c in extra) >= 3:
                rows[-1].description = f"{rows[-1].description} {extra}"
    return rows


# ─── Header fields ────────────────────────────────────────────────────────────
_DATE_PATTERNS = (
    re.compile(r"\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})\b"),
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    # OCR reading '/' as '1': "0811012026" -> 08/10/2026
    re.compile(r"\b(\d{2})[1lI|](\d{2})[1lI|](\d{4})\b"),
)


def _to_date(match: re.Match) -> Optional[date]:
    a, b, c = (int(g) for g in match.groups())
    if a > 1900:  # ISO
        y, m, d = a, b, c
    else:
        d, m, y = a, b, c
    try:
        parsed = date(y, m, d)
    except ValueError:
        return None
    return parsed if 2000 <= parsed.year <= 2100 else None


def _find_date(text: str) -> Optional[date]:
    for pattern in _DATE_PATTERNS:
        for match in pattern.finditer(text):
            parsed = _to_date(match)
            if parsed:
                return parsed
    return None


# Most to least trustworthy: the fiscal issue timestamp is printed by the tax
# system in a fixed format; a bare "Data"/"Date" may sit next to other dates.
_DATE_LABELS = (
    r"data\s+dhe\s+ora\s+e\s+leshimit",
    r"data\s+e\s+fatur",
    r"invoice\s+date",
    r"date\s+of\s+issue",
    r"\bdata\b",
    r"\bdate\b",
)


def parse_date(lines: list[str]) -> Optional[date]:
    folded = [fold(line) for line in lines]
    for label in _DATE_LABELS:
        for i, f in enumerate(folded):
            m = re.search(label, f)
            if m:
                found = _find_date(lines[i][m.end():]) or (
                    _find_date(lines[i + 1]) if i + 1 < len(lines) else None
                )
                if found:
                    return found
    return None


_NUMBER_LABELS = (
    r"nr\.?\s*(?:i\s+)?fatur[ea]s?",
    r"numri\s+i\s+fatur[ea]s",
    r"fatur[ea]\s*nr\.?",
    r"invoice\s*(?:no|nr|number|#)\.?",
    # A bare "Nr." whose value is itself a prefixed number: "Nr. FAT-2026-0421"
    r"^\s*nr\.?\s*(?=[a-z]{2,5}[-/]?\d)",
)
_INVOICE_NO = re.compile(r"[:#.\s]*([A-Z0-9][A-Z0-9\-/.]*\d[A-Z0-9\-/]*|\d+)", re.IGNORECASE)


def parse_invoice_number(lines: list[str]) -> Optional[str]:
    for line in lines:
        f = fold(line)
        for label in _NUMBER_LABELS:
            m = re.search(label, f)
            if m:
                value = _INVOICE_NO.match(line[m.end():])
                if value:
                    return value.group(1).rstrip(".")
    return None


# Prefix matches on purpose: OCR glues words ("Emrii Bleresit") and the
# Albanian forms inflect (shitesi / shitesit).
_SELLER_LABELS = (r"emri\s*i\s*shitesit", r"\bshites\w*", r"\bseller\b", r"\bsupplier\b", r"\bfurnizues\w*", r"\bvendor\b", r"\bfrom\s*:")
_BUYER_LABELS = (r"emri\s*i\s*bleresit", r"\bbleres\w*", r"\bbuyer\b", r"\bklient\w*", r"\bbill\s+to\b", r"\bcustomer\b")
# Albanian NIPT: letter, 8 digits, letter. OCR confuses 0/O, 1/I/l, 5/S, 8/B.
_NIPT = re.compile(r"\b([A-Z])\s?([0-9OoIlSB]{8})\s?([A-Z])\b")
_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "S": "5", "B": "8"})


def _first_line(lines: list[str], labels: tuple[str, ...]) -> Optional[int]:
    for i, line in enumerate(lines):
        f = fold(line)
        if any(re.search(label, f) for label in labels):
            return i
    return None


def _nipts(text: str) -> list[str]:
    return [a + digits.translate(_DIGIT_FIX) + b for a, digits, b in _NIPT.findall(text)]


def parse_supplier(lines: list[str]) -> tuple[Optional[str], Optional[str]]:
    seller_i = _first_line(lines, _SELLER_LABELS)
    buyer_i = _first_line(lines, _BUYER_LABELS)

    name = None
    if seller_i is not None:
        line = lines[seller_i]
        f = fold(line)
        m = next(re.search(label, f) for label in _SELLER_LABELS if re.search(label, f))
        rest = line[m.end():].lstrip(" :.-")
        # Address text bleeding in from the next column: "... light 1,28, fq. 14"
        rest = re.split(r"\s+(?:\S*\d\S*|fq\.?)(?:\s|$)", rest, maxsplit=1)[0]
        name = rest.strip(" ,;:") or None

    # The seller's tax number is the first one inside the seller block.
    tax = None
    if seller_i is not None:
        block_end = buyer_i if buyer_i is not None and buyer_i > seller_i else seller_i + 8
        found = _nipts("\n".join(lines[seller_i:block_end]))
        tax = found[0] if found else None
    if tax is None:
        buyer_block = set(_nipts("\n".join(lines[buyer_i:buyer_i + 6]))) if buyer_i is not None else set()
        tax = next((n for n in _nipts("\n".join(lines)) if n not in buyer_block), None)
    return name, tax


def _numbers_in(line: str) -> list[float]:
    return [v for v in (parse_number(t) for t in line.split()) if v is not None]


def parse_totals(lines: list[str], rows: list[ParsedLine]) -> tuple[Optional[float], Optional[float], Optional[float]]:
    subtotal = vat = total = None
    qty_sum = sum(r.quantity or 0 for r in rows)
    for line in lines:
        f = fold(line)
        nums = _numbers_in(line)
        if not nums:
            continue
        if re.search(r"nentotal|subtotal|pa\s+tvsh|without\s+vat|net\s+total", f):
            subtotal = nums[-1]
        elif re.search(r"\btotal", f):
            # "TOTALI  1,450.00" under a fiscal invoice is the sum of quantities.
            if len(nums) == 1 and rows and _close(nums[0], qty_sum):
                continue
            if len(nums) >= 3 and _close(nums[-3] + nums[-2], nums[-1]):
                subtotal, vat, total = nums[-3], nums[-2], nums[-1]
            else:
                total = nums[-1]
        elif re.search(r"\btvsh\b|\bvat\b", f) and vat is None:
            vat = nums[-1]
    return subtotal, vat, total


def parse_currency(text: str) -> str:
    f = fold(text)
    for pattern, code in CURRENCY_PATTERNS:
        if re.search(pattern, f):
            return code
    return "ALL"


# ─── Entry point ──────────────────────────────────────────────────────────────
def parse_invoice(text: str) -> ParsedInvoice:
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]

    inv = ParsedInvoice()
    inv.lines = parse_rows(lines)
    inv.invoice_number = parse_invoice_number(lines)
    inv.invoice_date = parse_date(lines)
    inv.supplier_name, inv.supplier_tax_number = parse_supplier(lines)
    inv.currency = parse_currency(text)
    inv.subtotal, inv.vat_total, inv.total = parse_totals(lines, inv.lines)

    priced = [r for r in inv.lines if r.kind != "skip" and r.net_amount is not None]
    net_sum = round(sum(r.net_amount for r in priced), 2)
    vat_sum = round(sum(r.vat_amount or 0 for r in priced), 2)
    if inv.subtotal is None and inv.total is not None and inv.vat_total is not None:
        inv.subtotal = round(inv.total - inv.vat_total, 2)
    if inv.subtotal is None and inv.total is not None and priced:
        # Only the grand total was printed (or read): take the net from the rows.
        inv.subtotal = net_sum
    if inv.vat_total is None and inv.total is not None and inv.subtotal is not None:
        inv.vat_total = round(inv.total - inv.subtotal, 2)
    if inv.total is None and priced:
        inv.subtotal = inv.subtotal if inv.subtotal is not None else net_sum
        inv.vat_total = inv.vat_total if inv.vat_total is not None else vat_sum
        inv.total = round(inv.subtotal + inv.vat_total, 2)
        inv.issues.append(INV_TOTALS_COMPUTED)
    elif priced and inv.subtotal is not None and not _close(net_sum, inv.subtotal):
        inv.issues.append(INV_TOTALS_MISMATCH)

    if not inv.lines:
        inv.issues.append(INV_NO_ROWS)
    if not inv.invoice_number:
        inv.issues.append(INV_NO_NUMBER)
    if not inv.invoice_date:
        inv.issues.append(INV_NO_DATE)
    if not inv.supplier_name and not inv.supplier_tax_number:
        inv.issues.append(INV_NO_SUPPLIER)
    return inv


def totals_match(subtotal: Optional[float], lines_net: float) -> bool:
    return subtotal is not None and _close(lines_net, subtotal)
