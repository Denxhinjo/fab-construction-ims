def test_regular_user_can_record_movement_in_permitted_location(
    client, regular_user, user_headers, two_locations, grant_location, products_in_both_locations,
):
    loc_a, _ = two_locations
    product_a, _ = products_in_both_locations
    grant_location(regular_user, loc_a)

    res = client.post(
        "/api/stock-movements",
        headers=user_headers,
        json={
            "product_id": product_a.id,
            "movement_type": "Stock In",
            "quantity": 5,
            "movement_date": "2026-01-01",
        },
    )
    assert res.status_code == 201
    assert res.json()["new_quantity"] == 15


def test_regular_user_cannot_record_movement_outside_permitted_location(
    client, regular_user, user_headers, two_locations, grant_location, products_in_both_locations,
):
    loc_a, _ = two_locations
    _, product_b = products_in_both_locations
    grant_location(regular_user, loc_a)

    res = client.post(
        "/api/stock-movements",
        headers=user_headers,
        json={
            "product_id": product_b.id,
            "movement_type": "Stock In",
            "quantity": 5,
            "movement_date": "2026-01-01",
        },
    )
    assert res.status_code == 403


def test_movement_list_scoped_to_permitted_locations(
    client, admin_headers, regular_user, user_headers, two_locations, grant_location, products_in_both_locations,
):
    loc_a, _ = two_locations
    product_a, product_b = products_in_both_locations
    grant_location(regular_user, loc_a)

    # Seed one movement per product as admin.
    for product in (product_a, product_b):
        res = client.post(
            "/api/stock-movements",
            headers=admin_headers,
            json={
                "product_id": product.id,
                "movement_type": "Stock In",
                "quantity": 1,
                "movement_date": "2026-01-01",
            },
        )
        assert res.status_code == 201

    admin_total = client.get("/api/stock-movements?page_size=50", headers=admin_headers).json()["total"]
    user_total = client.get("/api/stock-movements?page_size=50", headers=user_headers).json()["total"]
    assert admin_total == 2
    assert user_total == 1


def test_insufficient_stock_rejected(client, admin_headers, products_in_both_locations):
    _, product_b = products_in_both_locations  # quantity=1

    res = client.post(
        "/api/stock-movements",
        headers=admin_headers,
        json={
            "product_id": product_b.id,
            "movement_type": "Stock Out",
            "quantity": 100,
            "movement_date": "2026-01-01",
        },
    )
    assert res.status_code == 400
