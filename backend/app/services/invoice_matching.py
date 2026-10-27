"""
this file links what an invoice says to the records in our database

supplier: by tax number (nipt) first, then by name

material, per row, from most to least certain:
  1. alias   -- this supplier's code or description was confirmed before
  2. sku     -- the supplier's code equals one of our skus
  3. name    -- the description is close enough to one material's name
rows that match nothing become "new material" proposals. the person reviewing
the invoice accepts the proposal or picks a material, and that choice is saved
as an alias for next time (see remember_aliases)
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Optional

from sqlalchemy.orm import Session

from ..models.product import Product
from ..models.supplier import Supplier
from ..models.supplier_product_alias import SupplierProductAlias
from .invoice_parser import fold

NAME_MATCH_THRESHOLD = 0.82
SUPPLIER_NAME_THRESHOLD = 0.85
_NUMBER = re.compile(r"\d+(?:\.\d+)?")
_COMPANY_SUFFIXES = re.compile(r"\b(sh\.?\s?p\.?\s?k|sh\.?\s?a|shpk|ltd|llc|gmbh|srl|inc)\b\.?")


def normalize(text: Optional[str]) -> str:
    """this function makes a comparable form of a description: accents, case,
    punctuation and spacing removed, while keeping the parts that tell
    materials apart ('3x2.5', '42.5r', 'ø12')"""
    if not text:
        return ""
    f = fold(text).replace("ø", "o")
    f = re.sub(r"[^\w.x/]+", " ", f)
    f = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", f)  #this line removes dots that aren't decimal points
    return re.sub(r"\s+", " ", f).strip()


def normalize_tax_number(value: Optional[str]) -> str:
    return re.sub(r"\s+", "", value or "").upper()


def similarity(a: str, b: str) -> float:
    """this function scores how well invoice text `a` matches our name `b`: the best
    of character-level and word-level similarity, so both
    'Cimento CEM II 42.5R' ~ 'Çimento CEM II 42.5R, 25 kg' and reordered words
    score well"""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return 0.0
    #this block requires every number on the invoice to appear in our name, because
    #sizes and grades tell similar materials apart (Ø10 vs Ø12, 42.5R vs 32.5R)
    #however alike the words are. a missed match only costs one manual pick
    #(which is then remembered), a wrong match books stock into the wrong material
    num_a, num_b = set(_NUMBER.findall(na)), set(_NUMBER.findall(nb))
    if num_a and num_b and not num_a <= num_b:
        return 0.0
    chars = SequenceMatcher(None, na, nb).ratio()
    wa, wb = set(na.split()), set(nb.split())
    shorter = min(len(wa), len(wb))
    words = len(wa & wb) / shorter if shorter >= 2 else 0.0
    return max(chars, words * 0.95)


def match_supplier(db: Session, name: Optional[str], tax_number: Optional[str]) -> Optional[Supplier]:
    tax = normalize_tax_number(tax_number)
    suppliers = db.query(Supplier).filter(Supplier.is_active == True).all()  # noqa: E712
    if tax:
        for s in suppliers:
            if normalize_tax_number(s.tax_number) == tax:
                return s
    if name:
        bare = _COMPANY_SUFFIXES.sub("", fold(name)).strip()
        best, best_score = None, 0.0
        for s in suppliers:
            score = similarity(bare, _COMPANY_SUFFIXES.sub("", fold(s.name)).strip())
            if score > best_score:
                best, best_score = s, score
        if best_score >= SUPPLIER_NAME_THRESHOLD:
            return best
    return None


def match_product(
    db: Session,
    supplier_id: Optional[int],
    code: Optional[str],
    description: Optional[str],
    products: Optional[list[Product]] = None,
) -> tuple[Optional[Product], Optional[str]]:
    """this function returns (product, method) or (None, None)"""
    code_key, text_key = normalize(code), normalize(description)

    if supplier_id:
        aliases = db.query(SupplierProductAlias).filter(SupplierProductAlias.supplier_id == supplier_id)
        if code_key:
            hit = aliases.filter(SupplierProductAlias.kind == "code", SupplierProductAlias.key == code_key).first()
            if hit:
                return hit.product, "alias"
        if text_key:
            hit = aliases.filter(SupplierProductAlias.kind == "text", SupplierProductAlias.key == text_key).first()
            if hit:
                return hit.product, "alias"

    if products is None:
        products = db.query(Product).filter(Product.status != "archived").all()

    if code_key:
        for p in products:
            if p.sku and normalize(p.sku) == code_key:
                return p, "sku"

    if text_key:
        best, best_score = None, 0.0
        for p in products:
            score = similarity(description, p.name)
            if score > best_score:
                best, best_score = p, score
        if best_score >= NAME_MATCH_THRESHOLD:
            return best, "name"
    return None, None


def remember_aliases(
    db: Session, supplier_id: int, product_id: int, code: Optional[str], description: Optional[str], unit: Optional[str],
) -> None:
    for kind, raw in (("code", code), ("text", description)):
        key = normalize(raw)
        if not key:
            continue
        existing = (
            db.query(SupplierProductAlias)
            .filter_by(supplier_id=supplier_id, kind=kind, key=key)
            .first()
        )
        if existing:
            existing.product_id = product_id
            existing.unit = unit
        else:
            db.add(SupplierProductAlias(supplier_id=supplier_id, kind=kind, key=key, product_id=product_id, unit=unit))


def suggested_name(description: Optional[str]) -> str:
    """this function proposes a tidy name for a new material from the invoice text"""
    text = re.sub(r"\s+", " ", description or "").strip(" -.,")
    return text[:1].upper() + text[1:] if text else ""
