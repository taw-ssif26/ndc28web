import os, re, io, csv, asyncio, urllib.parse, urllib.request, time, hmac, hashlib, base64, json, secrets, uuid
from pathlib import Path
import psycopg
from PIL import Image, ImageOps
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from fastapi import FastAPI, Request, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

B = Path(__file__).parent
Image.MAX_IMAGE_PIXELS = 25_000_000
SECRET = os.environ["SECRET_KEY"].encode()
PROD = os.getenv("PROD") == "1"
PROXY_KEY = os.getenv("PROXY_KEY", "")            # shared secret: only your Vercel site may call this API
TURNSTILE = os.getenv("TURNSTILE_SECRET", "")     # Cloudflare Turnstile secret (bot check); empty = disabled
MAX_PENDING = int(os.getenv("MAX_PENDING", "300"))  # refuse new registrations if this many are waiting (stops DB flooding)
if PROD and len(SECRET) < 32: raise SystemExit("SECRET_KEY must be 32+ chars in production")
pool = ConnectionPool(os.environ["DATABASE_URL"], min_size=1, max_size=8, timeout=10, max_idle=120, open=False, check=ConnectionPool.check_connection,
                      kwargs={"row_factory": dict_row, "prepare_threshold": None})  # Neon pooler-safe, survives idle disconnects
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

def q(sql, a=(), one=False, commit=False):
    with pool.connection() as c:  # commits on clean exit, rolls back on error
        cur = c.execute(sql, a)
        if cur.description is None: return None
        r = cur.fetchall()
        return (r[0] if r else None) if one else r

def migrate():
    with pool.connection() as c:
        c.execute("select pg_advisory_xact_lock(42)")
        c.execute("create table if not exists schema_migrations(v text primary key, at timestamptz default now())")
        done = {r["v"] for r in c.execute("select v from schema_migrations").fetchall()}
        for f in sorted((B / "migrations").glob("*.sql")):
            if f.name not in done:
                c.execute(f.read_text()); c.execute("insert into schema_migrations(v) values(%s)", (f.name,)); print("applied", f.name)

def hp(p):
    s = secrets.token_bytes(16)
    return base64.b64encode(s + hashlib.scrypt(p.encode(), salt=s, n=2**14, r=8, p=1)).decode()
def vp(p, h):
    raw = base64.b64decode(h); s, k = raw[:16], raw[16:]
    return hmac.compare_digest(hashlib.scrypt(p.encode(), salt=s, n=2**14, r=8, p=1), k)
def sign(b): return hmac.new(SECRET, b.encode(), "sha256").hexdigest()
def fp(pw): return hashlib.sha256(pw.encode()).hexdigest()[:16]   # changes when the password changes -> old sessions die
def mk(uid, pw):
    b = base64.urlsafe_b64encode(json.dumps({"u": uid, "p": fp(pw), "e": int(time.time()) + 604800}).encode()).decode()
    return b + "." + sign(b)
def rd(t):
    try:
        b, s = t.split(".")
        if not hmac.compare_digest(s, sign(b)): return None
        d = json.loads(base64.urlsafe_b64decode(b))
        return d if d["e"] > time.time() else None
    except Exception: return None

def make_super(email, password):
    q("insert into users(name,whatsapp,group_no,roll,email,photo,pw,role,status) values(%s,%s,%s,%s,%s,%s,%s,'super','approved')",
      ("Super Admin", "super", 0, "super", email.lower(), "", hp(password)))

# ---- abuse protection helpers ----
def ip(r): return (r.headers.get("x-client-ip") or r.client.host)[:64] if PROXY_KEY else r.client.host   # x-client-ip is set by our Vercel proxy
def too_many(k, limit, window):
    now = time.time(); q("delete from login_fails where at<%s", (now - 3600,))
    return q("select count(*) n from login_fails where k=%s and at>%s", (k, now - window), one=True)["n"] >= limit
def hit(*ks):
    for k in ks: q("insert into login_fails values(%s,%s)", (k, time.time()))
def captcha_ok(token, addr):
    if not TURNSTILE: return True
    try:
        data = urllib.parse.urlencode({"secret": TURNSTILE, "response": token or "", "remoteip": addr}).encode()
        with urllib.request.urlopen("https://challenges.cloudflare.com/turnstile/v0/siteverify", data, timeout=5) as r: return json.load(r).get("success") is True
    except Exception: return False

# ---- tiny in-memory cache so busy pages don't hit the database every time ----
_c = {}
def cached(k, ttl, fn):
    h = _c.get(k)
    if h and h[0] > time.time(): return h[1]
    v = fn(); _c[k] = (time.time() + ttl, v); return v

def init():
    pool.open(); migrate()
    if not q("select 1 from users where role='super'", one=True):
        pw = os.environ["SUPER_PASSWORD"]
        if PROD and len(pw) < 12: raise SystemExit("SUPER_PASSWORD must be 12+ chars in production")
        make_super(os.environ["SUPER_EMAIL"], pw)

@app.on_event("startup")
def start(): init()

@app.exception_handler(psycopg.errors.UniqueViolation)
async def dup(r, e): return JSONResponse({"detail": "That value already exists"}, 409)

@app.middleware("http")
async def guard(r: Request, call_next):
    if PROXY_KEY and r.url.path != "/api/health" and not hmac.compare_digest(r.headers.get("x-proxy-key", ""), PROXY_KEY):
        return JSONResponse({"detail": "Forbidden"}, 403)          # direct hits on the Render URL are rejected
    if int(r.headers.get("content-length") or 0) > 4_000_000: return JSONResponse({"detail": "Too large"}, 413)
    if r.url.path.startswith("/api") and r.method != "GET" and r.headers.get("x-req") != "1":
        return JSONResponse({"detail": "Forbidden"}, 403)
    res = await call_next(r)
    res.headers.update({
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Strict-Transport-Security": "max-age=31536000; includeSubDomains"})
    if r.url.path.startswith("/api"): res.headers["X-Robots-Tag"] = "noindex"; res.headers.setdefault("Cache-Control", "no-store")
    return res

def me(r: Request):
    d = rd(r.cookies.get("s", ""))
    row = d and q("select * from users where id=%s", (d["u"],), one=True)
    if not row or row["status"] != "approved" or d["p"] != fp(row["pw"]): raise HTTPException(401, "Please log in")
    return row
def admin(u=Depends(me)):
    if u["role"] not in ("admin", "super"): raise HTTPException(403, "Admins only")
    return u
def sup(u=Depends(me)):
    if u["role"] != "super": raise HTTPException(403, "Super admin only")
    return u
def pub(u): return {k: v for k, v in u.items() if k not in ("pw", "photo")}

async def img(f: UploadFile, kind):
    b = await f.read(3_000_001)
    if len(b) > 3_000_000: raise HTTPException(400, "Image must be under 3MB")
    try:
        Image.open(io.BytesIO(b)).verify()
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(b))).convert("RGB")  # re-encode: strips EXIF/GPS and any payload
    except Exception: raise HTTPException(400, "Use a JPG, PNG or WebP image")
    im.thumbnail((1400, 1400) if kind == "g" else (600, 600))
    o = io.BytesIO(); im.save(o, "JPEG", quality=82, optimize=True)
    return str(q("insert into files(kind,data) values(%s,%s) returning id", (kind, o.getvalue()), one=True)["id"])

@app.get("/api/health")
def health():
    q("select 1"); return {"ok": True}

@app.post("/api/register")
async def register(r: Request, name: str = Form(...), whatsapp: str = Form(...), group_no: int = Form(...), roll: str = Form(...), email: str = Form(...),
                   password: str = Form(...), confirm: str = Form(...), photo: UploadFile = File(...),
                   apply_admin: str = Form(""), admin_reason: str = Form(""), captcha: str = Form("", alias="cf-turnstile-response")):
    rk = "reg:" + ip(r)
    if too_many(rk, 6, 3600): raise HTTPException(429, "Too many attempts from your network. Try again later.")
    hit(rk)
    if not await asyncio.to_thread(captcha_ok, captcha, ip(r)): raise HTTPException(400, "Bot check failed. Please retry.")
    if q("select count(*) n from users where status='pending'", one=True)["n"] >= MAX_PENDING: raise HTTPException(503, "Registrations are temporarily closed. Contact an admin.")
    email = email.strip().lower(); whatsapp = re.sub(r"[\s-]", "", whatsapp); roll = roll.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email): raise HTTPException(400, "Invalid email")
    if not re.fullmatch(r"\+?\d{10,15}", whatsapp): raise HTTPException(400, "Invalid WhatsApp number")
    if not re.fullmatch(r"\d{1,8}", roll): raise HTTPException(400, "Roll must be digits")
    if not 1 <= group_no <= 99: raise HTTPException(400, "Invalid group number")
    if len(password) < 10 or password != confirm: raise HTTPException(400, "Passwords must match and be 10+ characters")
    if len(name.strip()) < 2: raise HTTPException(400, "Enter your full name")
    want, reason = apply_admin == "1", admin_reason.strip()   # optional: apply to be an admin while registering
    if want and not 20 <= len(reason) <= 1000: raise HTTPException(400, "Tell us why you would make a good admin (20-1000 characters)")
    if q("select 1 from users where email=%s or roll=%s or whatsapp=%s", (email, roll, whatsapp), one=True):
        raise HTTPException(409, "Email, roll or WhatsApp already registered")
    p = await img(photo, "p")
    uid = q("insert into users(name,whatsapp,group_no,roll,email,photo,pw) values(%s,%s,%s,%s,%s,%s,%s) returning id",
      (name.strip()[:80], whatsapp, group_no, roll, email, p, hp(password)), one=True)["id"]
    if want: q("insert into admin_requests(user_id,reason) values(%s,%s)", (uid, reason))
    return {"ok": True}

@app.post("/api/login")
async def login(r: Request):
    d = await r.json(); i = str(d.get("id", "")).strip().lower().replace(" ", ""); ipk = "ip:" + ip(r)
    if too_many(i, 5, 600) or too_many(ipk, 25, 600): raise HTTPException(429, "Too many attempts. Try again in 10 minutes.")
    if not await asyncio.to_thread(captcha_ok, d.get("cf-turnstile-response"), ip(r)): raise HTTPException(400, "Bot check failed. Please retry.")
    u = q("select * from users where lower(email)=%s or roll=%s or whatsapp=%s", (i, i, i), one=True)
    if not u or not vp(str(d.get("password", "")), u["pw"]):
        hit(i, ipk); raise HTTPException(401, "Wrong credentials")
    if u["status"] == "pending": raise HTTPException(403, "Your registration is awaiting admin approval")
    if u["status"] == "rejected": raise HTTPException(403, "Your registration was not approved")
    q("delete from login_fails where k=%s", (i,))
    res = JSONResponse({"ok": True})
    res.set_cookie("s", mk(u["id"], u["pw"]), httponly=True, samesite="strict", secure=PROD, max_age=604800)
    return res

@app.post("/api/logout")
def logout():
    res = JSONResponse({"ok": True}); res.delete_cookie("s"); return res
@app.get("/api/me")
def whoami(u=Depends(me)): return pub(u)
@app.get("/api/photo/{uid}")
def photo(uid: int, u=Depends(me)):
    t = q("select photo from users where id=%s", (uid,), one=True)
    f = t and t["photo"] and q("select data from files where id=%s and kind='p'", (int(t["photo"]),), one=True)
    if not f or (u["id"] != uid and u["role"] == "student"): raise HTTPException(404)
    return Response(bytes(f["data"]), media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"})
@app.get("/media/{fid}")
def media(fid: int):
    f = q("select data from files where id=%s and kind='g'", (fid,), one=True)
    if not f: raise HTTPException(404)
    return Response(bytes(f["data"]), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable"})
@app.get("/api/community")
def community(u=Depends(me)):
    g = q("select link from groups where no=%s", (u["group_no"],), one=True)
    return {"group": u["group_no"], "link": g["link"] if g else None}

T = {"events": ["title", "starts", "ends", "location", "link", "details"], "notices": ["title", "body", "category", "pinned"],
     "resources": ["title", "kind", "url", "description"], "groups": ["no", "link"]}
ORD = {"events": "starts", "notices": "pinned desc, id desc", "resources": "id desc", "groups": "no"}
def clean(t, d):
    if t not in T: raise HTTPException(404)
    o = {}
    for f in T[t]:
        v = str(d.get(f, "")).strip()[:5000]
        if f in ("pinned", "no"):
            if not re.fullmatch(r"\d{1,3}", v): raise HTTPException(400, f"Invalid {f}")
            v = int(v)
        elif f in ("link", "url") and v and not re.match(r"https?://", v): raise HTTPException(400, "Links must start with http(s)://")
        o[f] = v
    if "title" in o and not o["title"]: raise HTTPException(400, "Title required")
    return o
@app.get("/api/c/{t}")
def lst(t: str, u=Depends(me)):
    if t not in T or (t == "groups" and u["role"] == "student"): raise HTTPException(404)
    return cached(("l", t), 15, lambda: q(f"select * from {t} order by {ORD[t]}"))
@app.post("/api/c/{t}")
async def add(t: str, r: Request, u=Depends(admin)):
    o = clean(t, await r.json()); k = list(o)
    up = " on conflict (no) do update set link=excluded.link" if t == "groups" else ""
    q(f"insert into {t}({','.join(k)}) values({','.join(['%s']*len(k))}){up}", list(o.values())); _c.clear(); return {"ok": True}
@app.put("/api/c/{t}/{i}")
async def upd(t: str, i: int, r: Request, u=Depends(admin)):
    o = clean(t, await r.json())
    q(f"update {t} set {','.join(k+'=%s' for k in o)} where id=%s", [*o.values(), i]); _c.clear(); return {"ok": True}
@app.delete("/api/c/{t}/{i}")
def rm(t: str, i: int, u=Depends(admin)):
    if t not in T: raise HTTPException(404)
    q(f"delete from {t} where id=%s", (i,)); _c.clear(); return {"ok": True}

@app.get("/api/gallery")
def gal():   # public + CDN-cached: landing-page visitors rarely reach the database
    return JSONResponse(cached("gal", 30, lambda: q("select * from gallery order by id desc")), headers={"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"})
@app.post("/api/gallery")
async def galadd(caption: str = Form(""), file: UploadFile = File(...), u=Depends(admin)):
    q("insert into gallery(caption,file) values(%s,%s)", (caption[:200], await img(file, "g"))); _c.clear(); return {"ok": True}
@app.delete("/api/gallery/{i}")
def galdel(i: int, u=Depends(admin)):
    g = q("select file from gallery where id=%s", (i,), one=True)
    if g: q("delete from files where id=%s", (int(g["file"]),)); q("delete from gallery where id=%s", (i,)); _c.clear()
    return {"ok": True}

@app.get("/api/admin/users")
def users(u=Depends(admin)): return [pub(x) for x in q("select * from users order by (status='pending') desc, id desc")]
@app.post("/api/admin/users/{i}/status")
async def setstatus(i: int, r: Request, u=Depends(admin)):
    s = (await r.json()).get("status")
    if s not in ("approved", "rejected"): raise HTTPException(400)
    q("update users set status=%s where id=%s and role='student'", (s, i)); return {"ok": True}
@app.patch("/api/admin/users/{i}")
async def edituser(i: int, r: Request, u=Depends(sup)):
    d = await r.json(); o = {}
    for f in ("name", "whatsapp", "roll", "email"):
        if f in d and str(d[f]).strip(): o[f] = str(d[f]).strip()[:80].lower() if f == "email" else str(d[f]).strip()[:80]
    if str(d.get("group_no", "")).isdigit(): o["group_no"] = int(d["group_no"])
    if d.get("role") in ("student", "admin"): o["role"] = d["role"]
    if d.get("status") in ("pending", "approved", "rejected"): o["status"] = d["status"]
    if d.get("password"):
        if len(d["password"]) < 10: raise HTTPException(400, "Password must be 10+ characters")
        o["pw"] = hp(d["password"])
    if o: q(f"update users set {','.join(k+'=%s' for k in o)} where id=%s and role<>'super'", [*o.values(), i])
    return {"ok": True}
@app.delete("/api/admin/users/{i}")
def deluser(i: int, u=Depends(sup)):
    q("delete from files where id::text in (select photo from users where id=%s and role<>'super')", (i,))
    q("delete from users where id=%s and role<>'super'", (i,)); return {"ok": True}

# ---- Admin applications: students apply, ONLY the super admin decides (admins can't promote admins) ----
@app.post("/api/admin-request")
async def apply_admin_later(r: Request, u=Depends(me)):
    if u["role"] != "student": raise HTTPException(400, "You are already an admin")
    reason = str((await r.json()).get("reason", "")).strip()
    if not 20 <= len(reason) <= 1000: raise HTTPException(400, "Tell us why you would make a good admin (20-1000 characters)")
    if q("select 1 from admin_requests where user_id=%s and status='pending'", (u["id"],), one=True): raise HTTPException(409, "You already have a pending application")
    q("insert into admin_requests(user_id,reason) values(%s,%s)", (u["id"], reason)); return {"ok": True}
@app.get("/api/admin-request/mine")
def my_request(u=Depends(me)):
    return q("select status, reason, created from admin_requests where user_id=%s order by id desc limit 1", (u["id"],), one=True) or {"status": None}
@app.get("/api/super/admin-requests")
def requests_list(u=Depends(sup)):
    return q("select a.id, a.reason, a.status, a.created, u.id user_id, u.name, u.roll, u.group_no, u.whatsapp, u.status user_status from admin_requests a join users u on u.id=a.user_id order by (a.status='pending') desc, a.id desc")
@app.post("/api/super/admin-requests/{i}")
async def decide_request(i: int, r: Request, u=Depends(sup)):
    d = (await r.json()).get("decision")
    if d not in ("approved", "rejected"): raise HTTPException(400)
    a = q("select * from admin_requests where id=%s and status='pending'", (i,), one=True)
    if not a: raise HTTPException(404, "No pending application")
    if d == "approved":
        if not q("select 1 from users where id=%s and status='approved'", (a["user_id"],), one=True): raise HTTPException(400, "Approve the student's registration first")
        q("update users set role='admin' where id=%s and role='student'", (a["user_id"],))
    q("update admin_requests set status=%s where id=%s", (d, i)); return {"ok": True}

@app.get("/api/super/stats")
def stats(u=Depends(sup)):
    s = {r["status"]: r["n"] for r in q("select status, count(*) n from users where role<>'super' group by status")}
    return {"users": s, **{t: q(f"select count(*) n from {t}", one=True)["n"] for t in ("events", "notices", "resources", "gallery", "groups")}}
@app.get("/api/super/export.csv")
def export(u=Depends(sup)):
    cols = ["id", "name", "whatsapp", "group_no", "roll", "email", "role", "status", "created"]
    o = io.StringIO(); w = csv.writer(o); w.writerow(cols)
    for r in q("select * from users order by id"):
        w.writerow(["'" + str(r[c]) if str(r[c]).startswith(("=", "+", "-", "@")) else r[c] for c in cols])  # CSV-injection safe
    return Response(o.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=batch28-users.csv"})

