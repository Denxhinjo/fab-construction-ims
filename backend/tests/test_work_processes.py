def test_create_requires_permitted_location_for_non_admin(client, regular_user, user_headers, two_locations, grant_location):
    loc_a, loc_b = two_locations
    grant_location(regular_user, loc_a)

    denied = client.post(
        "/api/work-processes",
        headers=user_headers,
        json={"title": "Task in B", "location_id": loc_b.id},
    )
    assert denied.status_code == 403

    allowed = client.post(
        "/api/work-processes",
        headers=user_headers,
        json={"title": "Task in A", "location_id": loc_a.id},
    )
    assert allowed.status_code == 201


def test_list_scoped_to_permitted_locations(client, admin_headers, regular_user, user_headers, two_locations, grant_location):
    loc_a, loc_b = two_locations
    grant_location(regular_user, loc_a)

    client.post("/api/work-processes", headers=admin_headers, json={"title": "Task A", "location_id": loc_a.id})
    client.post("/api/work-processes", headers=admin_headers, json={"title": "Task B", "location_id": loc_b.id})

    admin_total = client.get("/api/work-processes?page_size=50", headers=admin_headers).json()["total"]
    user_total = client.get("/api/work-processes?page_size=50", headers=user_headers).json()["total"]
    assert admin_total == 2
    assert user_total == 1


def test_delete_requires_admin(client, admin_headers, regular_user, user_headers, two_locations, grant_location):
    loc_a, _ = two_locations
    grant_location(regular_user, loc_a)
    created = client.post(
        "/api/work-processes", headers=admin_headers, json={"title": "Task A", "location_id": loc_a.id}
    ).json()

    denied = client.delete(f"/api/work-processes/{created['id']}", headers=user_headers)
    assert denied.status_code == 403

    allowed = client.delete(f"/api/work-processes/{created['id']}", headers=admin_headers)
    assert allowed.status_code == 204
