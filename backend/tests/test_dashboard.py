def test_admin_sees_global_totals(client, admin_headers, products_in_both_locations):
    res = client.get("/api/dashboard/stats", headers=admin_headers)
    assert res.status_code == 200
    stats = res.json()["stats"]
    assert stats["total_products"] == 2
    assert stats["total_locations"] == 2


def test_regular_user_sees_only_permitted_location_totals(
    client, regular_user, user_headers, two_locations, grant_location, products_in_both_locations,
):
    loc_a, _ = two_locations
    grant_location(regular_user, loc_a)

    res = client.get("/api/dashboard/stats", headers=user_headers)
    assert res.status_code == 200
    stats = res.json()["stats"]
    assert stats["total_products"] == 1
    assert stats["total_locations"] == 1


def test_dashboard_requires_auth(client):
    res = client.get("/api/dashboard/stats")
    assert res.status_code == 401
