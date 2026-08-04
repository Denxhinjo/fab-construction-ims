def test_admin_sees_products_in_every_location(client, admin_headers, products_in_both_locations):
    res = client.get("/api/products?page_size=50", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["total"] == 2


def test_regular_user_only_sees_permitted_location_products(
    client, regular_user, user_headers, two_locations, grant_location, products_in_both_locations,
):
    loc_a, _ = two_locations
    grant_location(regular_user, loc_a)

    res = client.get("/api/products?page_size=50", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Product A"


def test_regular_user_cannot_create_product_outside_permitted_location(
    client, regular_user, user_headers, two_locations, grant_location,
):
    loc_a, loc_b = two_locations
    grant_location(regular_user, loc_a)

    res = client.post(
        "/api/products",
        headers=user_headers,
        data={"name": "New Product", "location_id": loc_b.id, "quantity": 1},
    )
    assert res.status_code == 403


def test_regular_user_can_create_product_in_permitted_location(
    client, regular_user, user_headers, two_locations, grant_location,
):
    loc_a, _ = two_locations
    grant_location(regular_user, loc_a)

    res = client.post(
        "/api/products",
        headers=user_headers,
        data={"name": "New Product", "location_id": loc_a.id, "quantity": 1},
    )
    assert res.status_code == 201
    assert res.json()["location_id"] == loc_a.id


def test_delete_archives_instead_of_hard_deleting(client, admin_headers, products_in_both_locations):
    product_a, _ = products_in_both_locations

    res = client.delete(f"/api/products/{product_a.id}", headers=admin_headers)
    assert res.status_code == 204

    default_list = client.get("/api/products?page_size=50", headers=admin_headers).json()
    assert all(p["id"] != product_a.id for p in default_list["items"])

    with_archived = client.get("/api/products?page_size=50&include_archived=true", headers=admin_headers).json()
    archived = next(p for p in with_archived["items"] if p["id"] == product_a.id)
    assert archived["status"] == "archived"
    assert archived["archived_at"] is not None
    assert archived["archived_by_id"] is not None


def test_quantity_is_not_editable_via_update(client, admin_headers, products_in_both_locations):
    product_a, _ = products_in_both_locations
    original_quantity = product_a.quantity

    res = client.put(
        f"/api/products/{product_a.id}",
        headers=admin_headers,
        data={"quantity": 9999, "name": "Product A"},
    )
    assert res.status_code == 200
    assert res.json()["quantity"] == original_quantity
