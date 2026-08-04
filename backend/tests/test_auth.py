def test_login_succeeds_with_correct_credentials(client, user_factory):
    user_factory(email="jane@test.com", username="jane", password="CorrectHorse1")

    res = client.post(
        "/api/auth/login",
        data={"username": "jane@test.com", "password": "CorrectHorse1"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["role"] == "user"


def test_login_fails_with_wrong_password(client, user_factory):
    user_factory(email="jane@test.com", username="jane", password="CorrectHorse1")

    res = client.post(
        "/api/auth/login",
        data={"username": "jane@test.com", "password": "WrongPassword"},
    )
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_current_user(client, regular_user, user_headers):
    res = client.get("/api/auth/me", headers=user_headers)
    assert res.status_code == 200
    assert res.json()["email"] == regular_user.email
