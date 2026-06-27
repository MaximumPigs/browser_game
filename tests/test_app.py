from app import app


def client():
    app.config["TESTING"] = True
    return app.test_client()


def test_index_serves_game():
    res = client().get("/")
    assert res.status_code == 200
    assert b"Chicken Farm" in res.data


def test_health():
    res = client().get("/api/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "ok"}
