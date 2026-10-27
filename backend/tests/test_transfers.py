import pytest

from tests.conftest import add_stock


def stock_of(client, headers, product_id, location_id):
    rows = client.get("/api/stock", headers=headers).json()["rows"]
    return next(r for r in rows if r["id"] == product_id)["cells"][str(location_id)]["quantity"]


@pytest.fixture()
def sent(client, admin_headers, two_locations, products_in_both_locations):
    loc_a, loc_b = two_locations
    product_a, _ = products_in_both_locations
    res = client.post("/api/transfers", headers=admin_headers, json={
        "source_location_id": loc_a.id, "destination_location_id": loc_b.id,
        "driver": "Arben · AA 123 BB", "items": [{"product_id": product_a.id, "quantity": 6}],
    })
    assert res.status_code == 201, res.text
    return res.json()


def test_sending_takes_stock_out_immediately(client, admin_headers, two_locations, products_in_both_locations, sent):
    loc_a, loc_b = two_locations
    product_a, _ = products_in_both_locations
    assert sent["status"] == "IN_TRANSIT"
    assert sent["reference"].startswith("TR-")
    assert sent["driver"] == "Arben · AA 123 BB"
    assert stock_of(client, admin_headers, product_a.id, loc_a.id) == 4
    assert stock_of(client, admin_headers, product_a.id, loc_b.id) == 0
    assert client.get("/api/dashboard/counts", headers=admin_headers).json()["transfers_in_transit"] == 1


def test_received_in_full(client, admin_headers, two_locations, products_in_both_locations, sent):
    _, loc_b = two_locations
    product_a, _ = products_in_both_locations
    res = client.post(f"/api/transfers/{sent['id']}/receive", headers=admin_headers, json={})
    assert res.json()["status"] == "RECEIVED"
    assert stock_of(client, admin_headers, product_a.id, loc_b.id) == 6
    again = client.post(f"/api/transfers/{sent['id']}/receive", headers=admin_headers, json={})
    assert again.status_code == 400


def test_received_with_differences(client, admin_headers, two_locations, products_in_both_locations, sent):
    _, loc_b = two_locations
    product_a, _ = products_in_both_locations
    item_id = sent["items"][0]["id"]
    res = client.post(f"/api/transfers/{sent['id']}/receive", headers=admin_headers, json={
        "items": [{"item_id": item_id, "received_quantity": 5}],
    })
    body = res.json()
    assert body["status"] == "RECEIVED_PARTIAL"
    assert body["items"][0]["notes"] == "Mungojnë 1"
    assert stock_of(client, admin_headers, product_a.id, loc_b.id) == 5
    closed = client.get("/api/transfers?status=closed", headers=admin_headers).json()
    assert closed["total"] == 1


def test_cannot_receive_more_than_sent(client, admin_headers, sent):
    res = client.post(f"/api/transfers/{sent['id']}/receive", headers=admin_headers, json={
        "items": [{"item_id": sent["items"][0]["id"], "received_quantity": 7}],
    })
    assert res.status_code == 400


def test_cannot_send_more_than_available(client, admin_headers, two_locations, products_in_both_locations):
    loc_a, loc_b = two_locations
    product_a, _ = products_in_both_locations
    res = client.post("/api/transfers", headers=admin_headers, json={
        "source_location_id": loc_a.id, "destination_location_id": loc_b.id,
        "items": [{"product_id": product_a.id, "quantity": 11}],
    })
    assert res.status_code == 400
    assert client.get("/api/transfers", headers=admin_headers).json()["total"] == 0


def test_same_warehouse_rejected(client, admin_headers, two_locations, products_in_both_locations):
    loc_a, _ = two_locations
    product_a, _ = products_in_both_locations
    res = client.post("/api/transfers", headers=admin_headers, json={
        "source_location_id": loc_a.id, "destination_location_id": loc_a.id,
        "items": [{"product_id": product_a.id, "quantity": 1}],
    })
    assert res.status_code == 422


def test_sending_and_receiving_need_warehouse_access(
    client, db_session, regular_user, user_headers, grant_location, two_locations, products_in_both_locations,
    admin_headers,
):
    loc_a, loc_b = two_locations
    product_a, _ = products_in_both_locations
    body = {
        "source_location_id": loc_a.id, "destination_location_id": loc_b.id,
        "items": [{"product_id": product_a.id, "quantity": 1}],
    }
    assert client.post("/api/transfers", headers=user_headers, json=body).status_code == 403
    grant_location(regular_user, loc_a)
    sent = client.post("/api/transfers", headers=user_headers, json=body).json()
    #this line grants a (the source) but not b (the destination)
    res = client.post(f"/api/transfers/{sent['id']}/receive", headers=user_headers, json={})
    assert res.status_code == 403
