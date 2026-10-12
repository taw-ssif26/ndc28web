import os, pytest
from fastapi.testclient import TestClient
import main
H = {"X-Req": "1"}
import io
from PIL import Image
_b = io.BytesIO(); Image.new("RGB", (40, 40), "navy").save(_b, "PNG"); PNG = _b.getvalue()
D = dict(name="Ab Cd", father="Fa", mother="Ma", parent_phone="01700000000", whatsapp="01711111111", group_no=3,
         roll="12", email="a@b.com", password="password1", confirm="password1")

@pytest.fixture()
def apps():
    with TestClient(main.app) as boss:
        main.q("truncate users, admin_requests, events, notices, resources, groups, gallery, login_fails restart identity")
        main.init()
        assert boss.post("/api/login", json={"id": os.environ["SUPER_EMAIL"], "password": os.environ["SUPER_PASSWORD"]}, headers=H).status_code == 200
        with TestClient(main.app) as kid: yield boss, kid

def reg(c, **o): return c.post("/api/register", data={**D, **o}, files={"photo": ("p.png", PNG, "image/png")}, headers=H)

def test_full_flow(apps):
    boss, kid = apps
    assert reg(kid).status_code == 200
    assert reg(kid).status_code == 409                                           # duplicate
    assert kid.post("/api/login", json={"id": "12", "password": "password1"}, headers=H).status_code == 403  # pending
    assert kid.get("/api/c/events").status_code == 401                           # public sees nothing
    sid = [u for u in boss.get("/api/admin/users").json() if u["roll"] == "12"][0]["id"]
    boss.post("/api/c/groups", json={"no": 3, "link": "https://chat.whatsapp.com/x"}, headers=H)
    assert boss.post(f"/api/admin/users/{sid}/status", json={"status": "approved"}, headers=H).status_code == 200
    for ident in ("12", "a@b.com", "01711111111"):
        assert kid.post("/api/login", json={"id": ident, "password": "password1"}, headers=H).status_code == 200
    assert kid.get("/api/community").json()["link"].startswith("https://chat.whatsapp")
    assert kid.get("/api/admin/users").status_code == 403                        # student != admin
    assert kid.post("/api/c/notices", json={"title": "x"}, headers=H).status_code == 403
    assert boss.post("/api/c/notices", json={"title": "N", "body": "b", "category": "General", "pinned": 1}, headers=H).status_code == 200
    assert kid.get("/api/c/notices").json()[0]["title"] == "N"

def test_admin_application(apps):
    boss, kid = apps
    assert reg(kid, apply_admin="1", admin_reason="too short").status_code == 400        # reason required, nothing created
    assert reg(kid, apply_admin="1", admin_reason="I run the batch study group and can manage notices.").status_code == 200
    rid = boss.get("/api/super/admin-requests").json()[0]["id"]
    assert boss.post(f"/api/super/admin-requests/{rid}", json={"decision": "approved"}, headers=H).status_code == 400   # student not approved yet
    sid = [u for u in boss.get("/api/admin/users").json() if u["roll"] == "12"][0]["id"]
    boss.post(f"/api/admin/users/{sid}/status", json={"status": "approved"}, headers=H)
    assert kid.post("/api/login", json={"id": "12", "password": "password1"}, headers=H).status_code == 200
    assert kid.get("/api/admin-request/mine").json()["status"] == "pending"
    assert kid.post("/api/admin-request", json={"reason": "x" * 30}, headers=H).status_code == 409                    # one pending at a time
    assert kid.get("/api/super/admin-requests").status_code == 403                                                    # students can't decide
    assert kid.get("/api/admin/users").status_code == 403
    assert boss.post(f"/api/super/admin-requests/{rid}", json={"decision": "approved"}, headers=H).status_code == 200
    assert kid.get("/api/admin/users").status_code == 200                                                             # now an admin

def test_apply_later(apps):
    boss, kid = apps
    reg(kid); sid = [u for u in boss.get("/api/admin/users").json() if u["roll"] == "12"][0]["id"]
    boss.post(f"/api/admin/users/{sid}/status", json={"status": "approved"}, headers=H)
    kid.post("/api/login", json={"id": "12", "password": "password1"}, headers=H)
    assert kid.get("/api/admin-request/mine").json()["status"] is None
    assert kid.post("/api/admin-request", json={"reason": "I want to help organise events for everyone."}, headers=H).status_code == 200
    assert boss.post(f"/api/super/admin-requests/{boss.get('/api/super/admin-requests').json()[0]['id']}", json={"decision": "rejected"}, headers=H).status_code == 200
    assert kid.get("/api/admin-request/mine").json()["status"] == "rejected"

def test_security(apps):
    boss, kid = apps
    assert boss.post("/api/c/events", json={"title": "x"}).status_code == 403    # CSRF header
    assert reg(kid, roll="13", email="c@d.com", whatsapp="01722222222").status_code == 200
    bad = kid.post("/api/register", data={**D, "roll": "14", "email": "e@f.com", "whatsapp": "01733333333"}, files={"photo": ("x.png", b"<script>", "image/png")}, headers=H)
    assert bad.status_code == 400                                                # not a real image
    for _ in range(5): kid.post("/api/login", json={"id": "nobody", "password": "x"}, headers=H)
    assert kid.post("/api/login", json={"id": "nobody", "password": "x"}, headers=H).status_code == 429
    assert boss.get("/api/health").json()["ok"]
    assert "pw" not in boss.get("/api/admin/users").json()[0]
    sid = [u for u in boss.get("/api/admin/users").json() if u["roll"] == "13"][0]["id"]
    assert boss.get(f"/api/photo/{sid}").headers["content-type"] == "image/jpeg"   # stored in DB, re-encoded
    assert kid.get(f"/api/photo/{sid}").status_code == 401
