from fastapi.testclient import TestClient

from app.main import app


def _sample_body(client):
    s = client.get("/api/samples").json()[0]
    return {"features": {k: v for k, v in s.items() if not k.startswith("_")}}


def test_health():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"


def test_predict_ok():
    with TestClient(app) as client:
        r = client.post("/api/predict", json=_sample_body(client))
        assert r.status_code == 200
        d = r.json()
        assert set(d["predictions"]) == {"CAD", "LAD", "LCX", "RCA"}
        assert "disclaimer" in d
        for vessel in ("CAD", "LAD", "LCX", "RCA"):
            assert d["explanations"][vessel], vessel


def test_rca_explanations_not_all_zero():
    with TestClient(app) as client:
        d = client.post("/api/predict", json=_sample_body(client)).json()
        assert any(abs(e["shap_value"]) > 0 for e in d["explanations"]["RCA"])


def test_units_are_not_garbled():
    with TestClient(app) as client:
        d = client.post("/api/predict", json=_sample_body(client)).json()
        units = {e["unit"] for v in d["explanations"].values() for e in v}
        assert not any("Â" in u for u in units)


def test_unknown_feature_rejected():
    with TestClient(app) as client:
        r = client.post("/api/predict", json={"features": {"Agee": 60}})
        assert r.status_code == 422


def test_bad_category_rejected():
    with TestClient(app) as client:
        r = client.post("/api/predict", json={"features": {"BBB": "XYZ"}})
        assert r.status_code == 422


def test_evaluation_endpoint():
    with TestClient(app) as client:
        assert client.get("/api/evaluation").status_code == 200