import fitz
import pytest

from app.models.product import Product
from app.models.supplier import Supplier
from app.models.supplier_product_alias import SupplierProductAlias
from app.services import invoice_reader
from tests.conftest import add_stock, auth_headers


def make_pdf(lines: list[str]) -> bytes:
    """A digital (text-layer) invoice PDF, like invoicing software exports."""
    doc = fitz.open()
    page = doc.new_page()
    for i, line in enumerate(lines):
        page.insert_text((40, 60 + i * 16), line, fontsize=9)
    return doc.tobytes()


def invoice_lines(number="523", rebar_price="14.90", rebar_net="894.00"):
    return [
        "FATURE TATIMORE SHITJE",
        f"Data 08/10/2026     Nr. Fature {number}",
        "Emri i Shitesit : Metal-Kos",
        "Numri i Identifikimit te Personit te Tatueshem: K11223344M",
        "Emri i Bleresit : FAB CONSTRUCTION  L00000000A",
        "Nr Kod Pershkrimi i mallit Njesia Sasia Cmimi Vlera TVSH Vlera me TVSH",
        f"1 HEK12 Hekur armature Ø12, 12 m COP 60 {rebar_price} {rebar_net} 178.80 1,072.80",
        "2 RRJ188 Rrjete armature Q188 COP 20 38.00 760.00 152.00 912.00",
        "3 TR01 Transport deri ne depo COP 1 50.00 50.00 10.00 60.00",
        "TOTALI Leke 1,704.00 340.80 2,044.80",
    ]


@pytest.fixture()
def supplier(db_session):
    s = Supplier(name="Metal-Kos SH.P.K.", tax_number="K11223344M")
    db_session.add(s)
    db_session.commit()
    return s


@pytest.fixture()
def rebar(db_session):
    p = Product(name="Hekur armature Ø12, 12 m", sku="HEK-012-12", unit="shufër", quantity=0)
    db_session.add(p)
    db_session.commit()
    return p


def upload(client, headers, content: bytes, location_id=None, name="fatura.pdf"):
    data = {"location_id": str(location_id)} if location_id else {}
    return client.post("/api/invoices", headers=headers, files={"file": (name, content, "application/pdf")}, data=data)


def accept_payload(invoice: dict, **overrides) -> dict:
    payload = {
        "supplier_id": invoice["supplier_id"],
        "invoice_number": invoice["invoice_number"],
        "invoice_date": invoice["invoice_date"],
        "location_id": invoice["location_id"],
        "lines": [
            {
                "id": l["id"], "kind": l["kind"], "quantity": l["quantity"], "unit": l["unit"],
                "unit_price": l["unit_price"], "product_id": l["product_id"], "new_name": l["new_name"],
                "new_category": l["new_category"], "new_min": l["new_min"],
            }
            for l in invoice["lines"]
        ],
    }
    payload.update(overrides)
    return payload


def test_upload_reads_matches_and_waits_for_review(client, admin_headers, two_locations, supplier, rebar):
    loc_a, _ = two_locations
    res = upload(client, admin_headers, make_pdf(invoice_lines()), loc_a.id)
    assert res.status_code == 201, res.text
    inv = res.json()

    assert inv["status"] == "review"
    assert inv["used_ocr"] is False
    assert inv["invoice_number"] == "523"
    assert inv["invoice_date"] == "2026-10-08"
    assert inv["supplier_id"] == supplier.id  # matched by NIPT
    assert inv["total"] == 2044.80
    assert inv["review_queue"] == [inv["id"]]

    rebar_line, mesh_line, transport = inv["lines"]
    assert rebar_line["product_id"] == rebar.id and rebar_line["match_method"] == "name"
    assert rebar_line["confidence"] == "ok"
    assert mesh_line["product_id"] is None and mesh_line["new_name"] == "Rrjete armature Q188"
    assert transport["kind"] == "extra"

    # Nothing is booked until someone confirms.
    assert client.get("/api/stock", headers=admin_headers).json()["rows"][0]["total"] == 0


def test_accept_books_stock_creates_materials_and_remembers_aliases(
    client, admin_headers, db_session, two_locations, supplier, rebar,
):
    loc_a, _ = two_locations
    inv = upload(client, admin_headers, make_pdf(invoice_lines()), loc_a.id).json()
    payload = accept_payload(inv)
    payload["lines"][1].update(new_name="Rrjetë armature Q188", new_category="Hekur", new_min=20)

    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=payload)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "accepted"

    stock = {r["name"]: r for r in client.get("/api/stock", headers=admin_headers).json()["rows"]}
    assert stock["Hekur armature Ø12, 12 m"]["cells"][str(loc_a.id)]["quantity"] == 60
    assert stock["Hekur armature Ø12, 12 m"]["avg_cost"] == 14.9
    assert stock["Hekur armature Ø12, 12 m"]["last_supplier"] == "Metal-Kos SH.P.K."
    mesh = stock["Rrjetë armature Q188"]
    assert mesh["cells"][str(loc_a.id)] == {"quantity": 20, "min": 20, "below_min": False}
    assert mesh["category"] == "Hekur"
    assert "Transport deri ne depo" not in stock  # extra cost, not stock

    history = client.get("/api/stock-movements?kind=in", headers=admin_headers).json()
    assert history["total"] == 2
    assert {m["reference_number"] for m in history["items"]} == {"523"}

    aliases = db_session.query(SupplierProductAlias).filter_by(supplier_id=supplier.id).all()
    assert {(a.kind, a.key) for a in aliases} >= {("code", "hek12"), ("code", "rrj188")}


def test_second_invoice_matches_by_alias_and_averages_cost(client, admin_headers, two_locations, supplier, rebar):
    loc_a, _ = two_locations
    first = upload(client, admin_headers, make_pdf(invoice_lines()), loc_a.id).json()
    client.post(f"/api/invoices/{first['id']}/accept", headers=admin_headers, json=accept_payload(first))

    second = upload(
        client, admin_headers, make_pdf(invoice_lines("524", "16.90", "1,014.00")), loc_a.id,
    ).json()
    mesh_line = second["lines"][1]
    assert mesh_line["match_method"] == "alias"  # created by the first invoice
    rebar_line = second["lines"][0]
    assert rebar_line["match_method"] == "alias"

    client.post(f"/api/invoices/{second['id']}/accept", headers=admin_headers, json=accept_payload(second))
    row = next(r for r in client.get("/api/stock", headers=admin_headers).json()["rows"] if r["id"] == rebar.id)
    assert row["total"] == 120
    assert row["avg_cost"] == pytest.approx(15.9)  # (60 x 14.90 + 60 x 16.90) / 120


def test_same_invoice_twice_needs_confirmation(client, admin_headers, two_locations, supplier, rebar):
    loc_a, _ = two_locations
    first = upload(client, admin_headers, make_pdf(invoice_lines()), loc_a.id).json()
    client.post(f"/api/invoices/{first['id']}/accept", headers=admin_headers, json=accept_payload(first))

    again = upload(client, admin_headers, make_pdf(invoice_lines()), loc_a.id).json()
    assert again["duplicate_of"] == first["id"]
    res = client.post(f"/api/invoices/{again['id']}/accept", headers=admin_headers, json=accept_payload(again))
    assert res.status_code == 409
    res = client.post(
        f"/api/invoices/{again['id']}/accept", headers=admin_headers,
        json=accept_payload(again, allow_duplicate=True),
    )
    assert res.status_code == 200


def test_accept_requires_warehouse_and_names_for_new_materials(client, admin_headers, two_locations, supplier, rebar):
    inv = upload(client, admin_headers, make_pdf(invoice_lines())).json()
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=accept_payload(inv))
    assert res.status_code == 400 and "warehouse" in res.json()["detail"]

    payload = accept_payload(inv, location_id=two_locations[0].id)
    payload["lines"][1]["new_name"] = ""
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=payload)
    assert res.status_code == 400 and "Row 2" in res.json()["detail"]
    # A failed accept leaves the invoice open and stock untouched.
    assert client.get(f"/api/invoices/{inv['id']}", headers=admin_headers).json()["status"] == "review"
    assert client.get("/api/stock-movements", headers=admin_headers).json()["total"] == 0


def test_save_for_later_then_reject(client, admin_headers, two_locations, supplier, rebar):
    inv = upload(client, admin_headers, make_pdf(invoice_lines())).json()
    payload = accept_payload(inv, location_id=two_locations[1].id)
    payload["lines"] = payload["lines"][:1]  # drop rows 2-3
    saved = client.put(f"/api/invoices/{inv['id']}", headers=admin_headers, json=payload).json()
    assert saved["location_id"] == two_locations[1].id
    assert len(saved["lines"]) == 1

    rejected = client.post(f"/api/invoices/{inv['id']}/reject", headers=admin_headers).json()
    assert rejected["status"] == "rejected"
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=payload)
    assert res.status_code == 400


def test_new_supplier_created_on_review(client, admin_headers, two_locations, rebar):
    inv = upload(client, admin_headers, make_pdf(invoice_lines()), two_locations[0].id).json()
    assert inv["supplier_id"] is None
    assert inv["supplier_name_raw"] == "Metal-Kos"
    payload = accept_payload(inv, supplier_id=None, new_supplier={"name": "Metal-Kos", "tax_number": "k11223344m"})
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=payload)
    assert res.status_code == 200, res.text
    suppliers = client.get("/api/suppliers", headers=admin_headers).json()
    assert [(s["name"], s["tax_number"]) for s in suppliers] == [("Metal-Kos", "K11223344M")]


def test_scan_without_ocr_is_kept_for_manual_entry(client, admin_headers, monkeypatch, two_locations):
    monkeypatch.setattr(invoice_reader, "ocr_available", lambda: False)
    doc = fitz.open()
    doc.new_page().insert_text((40, 60), "CamScanner", fontsize=9)  # a scan: no real text layer
    inv = upload(client, admin_headers, doc.tobytes(), two_locations[0].id, name="skanim.pdf").json()
    assert inv["status"] == "failed"
    assert inv["read_issues"] == ["ocr_unavailable"]

    # Entered by hand: a row with no id is added.
    payload = {
        "new_supplier": {"name": "Gurorja"},
        "invoice_number": "77",
        "location_id": two_locations[0].id,
        "lines": [{"kind": "stock", "raw_description": "Rërë lumi", "quantity": 10, "unit": "m³",
                   "unit_price": 22, "new_name": "Rërë lumi"}],
    }
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=payload)
    assert res.status_code == 200, res.text
    assert res.json()["lines"][0]["net_amount"] == 220


def test_rejects_files_that_are_not_invoices(client, admin_headers):
    res = client.post("/api/invoices", headers=admin_headers, files={"file": ("x.txt", b"hello", "text/plain")})
    assert res.status_code == 400


def test_file_is_served_back(client, admin_headers, two_locations):
    content = make_pdf(invoice_lines())
    inv = upload(client, admin_headers, content, two_locations[0].id).json()
    res = client.get(f"/api/invoices/{inv['id']}/file", headers=admin_headers)
    assert res.status_code == 200
    assert res.content == content
    assert res.headers["content-type"] == "application/pdf"


def test_viewer_cannot_upload(client, viewer_user):
    res = upload(client, auth_headers(viewer_user), make_pdf(invoice_lines()))
    assert res.status_code == 403


def test_user_needs_access_to_the_receiving_warehouse(
    client, admin_headers, regular_user, user_headers, grant_location, two_locations, supplier, rebar,
):
    loc_a, loc_b = two_locations
    grant_location(regular_user, loc_a)
    inv = upload(client, user_headers, make_pdf(invoice_lines()), loc_b.id).json()
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=user_headers, json=accept_payload(inv))
    assert res.status_code == 403
    res = client.post(
        f"/api/invoices/{inv['id']}/accept", headers=user_headers, json=accept_payload(inv, location_id=loc_a.id),
    )
    assert res.status_code == 200


def test_list_counts_by_status(client, admin_headers, two_locations):
    upload(client, admin_headers, make_pdf(invoice_lines()))
    upload(client, admin_headers, make_pdf(invoice_lines("524")))
    body = client.get("/api/invoices", headers=admin_headers).json()
    assert body["counts"] == {"review": 2, "all": 2}
    assert body["items"][0]["supplier_name"] == "Metal-Kos"
    assert body["items"][0]["line_count"] == 3


def test_euro_invoice_costs_are_converted_to_lek(client, admin_headers, two_locations, supplier, rebar):
    loc_a, _ = two_locations
    lines = invoice_lines()[:-1] + ["Kursi: EUR = 100.00", "TOTALI EUR 1,704.00 340.80 2,044.80"]
    inv = upload(client, admin_headers, make_pdf(lines), loc_a.id).json()
    assert (inv["currency"], inv["exchange_rate"]) == ("EUR", 100.0)

    # Without a rate the invoice can't be booked: its costs couldn't be valued in lek.
    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers,
                      json=accept_payload(inv, exchange_rate=None))
    assert res.status_code == 400 and "exchange rate" in res.json()["detail"]

    res = client.post(f"/api/invoices/{inv['id']}/accept", headers=admin_headers, json=accept_payload(inv))
    assert res.status_code == 200, res.text
    row = next(r for r in client.get("/api/stock", headers=admin_headers).json()["rows"] if r["id"] == rebar.id)
    assert row["avg_cost"] == pytest.approx(1490.0)  # 14.90 EUR x 100
