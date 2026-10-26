from tests.conftest import add_stock


def test_stock_matrix_has_a_cell_per_warehouse(client, admin_headers, two_locations, products_in_both_locations):
    loc_a, loc_b = two_locations
    body = client.get("/api/stock", headers=admin_headers).json()
    assert [l["name"] for l in body["locations"]] == ["Warehouse A", "Warehouse B"]
    rows = {r["name"]: r for r in body["rows"]}
    a = rows["Product A"]["cells"]
    assert a[str(loc_a.id)] == {"quantity": 10, "min": 2, "below_min": False}
    assert a[str(loc_b.id)]["quantity"] == 0
    b = rows["Product B"]["cells"][str(loc_b.id)]
    assert b == {"quantity": 1, "min": 5, "below_min": True}


def test_stock_filters(client, admin_headers, two_locations, products_in_both_locations):
    loc_a, loc_b = two_locations
    below = client.get("/api/stock?below_min=true", headers=admin_headers).json()["rows"]
    assert [r["name"] for r in below] == ["Product B"]
    in_a = client.get(f"/api/stock?location_id={loc_a.id}", headers=admin_headers).json()["rows"]
    assert [r["name"] for r in in_a] == ["Product A"]
    found = client.get("/api/stock?search=duct b", headers=admin_headers).json()["rows"]
    assert [r["name"] for r in found] == ["Product B"]


def test_export_is_excel_friendly_csv(client, admin_headers, products_in_both_locations):
    res = client.get("/api/stock/export", headers=admin_headers)
    assert res.status_code == 200
    text = res.content.decode("utf-8")
    assert text.startswith("﻿Materiali;SKU;Kategoria;Njësia;Warehouse A;Warehouse B;Gjithsej")
    assert "Product A;;;copë;10;0;10;5,00;" in text


def test_physical_count_correction(client, admin_headers, two_locations, products_in_both_locations):
    loc_a, _ = two_locations
    product_a, _ = products_in_both_locations
    res = client.post("/api/stock/adjust", headers=admin_headers, json={
        "product_id": product_a.id, "location_id": loc_a.id, "counted_quantity": 8, "note": "numërim fizik",
    })
    assert res.status_code == 201
    assert res.json() == {"changed": True, "reference": f"KOR-{res.json()['reference'][4:8]}-0001"}

    history = client.get("/api/stock-movements?kind=adjustment", headers=admin_headers).json()["items"]
    assert [(m["movement_type"], m["quantity"], m["reason"]) for m in history] == [
        ("Adjustment Out", 2, "numërim fizik"),
    ]
    same = client.post("/api/stock/adjust", headers=admin_headers, json={
        "product_id": product_a.id, "location_id": loc_a.id, "counted_quantity": 8,
    })
    assert same.json()["changed"] is False


def test_correction_needs_warehouse_access(client, regular_user, user_headers, two_locations, products_in_both_locations):
    loc_a, _ = two_locations
    product_a, _ = products_in_both_locations
    res = client.post("/api/stock/adjust", headers=user_headers, json={
        "product_id": product_a.id, "location_id": loc_a.id, "counted_quantity": 1,
    })
    assert res.status_code == 403


def test_create_material_with_per_warehouse_minimums(client, admin_headers, two_locations):
    loc_a, loc_b = two_locations
    res = client.post("/api/products", headers=admin_headers, json={
        "name": "Rërë lumi", "sku": "AGR-RER", "category_name": "Agregate", "unit": "m³",
        "min_stock_level": 0, "location_mins": {str(loc_a.id): 10},
    })
    assert res.status_code == 201, res.text
    row = client.get("/api/stock", headers=admin_headers).json()["rows"][0]
    assert row["category"] == "Agregate"
    assert row["cells"][str(loc_a.id)] == {"quantity": 0, "min": 10, "below_min": True}
    assert row["cells"][str(loc_b.id)]["min"] == 0

    clash = client.post("/api/products", headers=admin_headers, json={"name": "Tjetër", "sku": "agr-rer"})
    assert clash.status_code == 400


def test_only_admins_edit_materials(client, user_headers):
    assert client.post("/api/products", headers=user_headers, json={"name": "X"}).status_code == 403


def test_archive_refuses_materials_with_stock(client, admin_headers, db_session, two_locations, products_in_both_locations):
    product_a, _ = products_in_both_locations
    assert client.delete(f"/api/products/{product_a.id}", headers=admin_headers).status_code == 400


def test_dashboard(client, admin_headers, db_session, two_locations, products_in_both_locations):
    loc_a, loc_b = two_locations
    _, product_b = products_in_both_locations
    add_stock(db_session, product_b, loc_a, 20)  # A can cover B's shortfall

    body = client.get("/api/dashboard", headers=admin_headers).json()
    assert body["todo"]["below_min"] == 1
    assert body["todo"]["below_min_coverable"] == 1
    depots = {d["name"]: d for d in body["depots"]}
    assert depots["Warehouse A"]["value"] == 10 * 5 + 20 * 10
    assert depots["Warehouse B"]["below_min"] == 1
    assert body["total_value"] == 250 + 10
    item = body["below_min"][0]
    assert (item["product_name"], item["location_name"], item["source_location_name"], item["can_transfer"]) == (
        "Product B", "Warehouse B", "Warehouse A", 4,
    )


def test_dashboard_requires_auth(client):
    assert client.get("/api/dashboard").status_code == 401


def test_search(client, admin_headers, products_in_both_locations):
    body = client.get("/api/search?q=product a", headers=admin_headers).json()
    assert [p["name"] for p in body["products"]] == ["Product A"]
