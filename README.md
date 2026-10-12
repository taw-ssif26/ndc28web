# NDC Batch 28 — Next.js + Python (FastAPI) + Neon
Browser → Next.js (Vercel) → rewrites `/api` + `/media` → FastAPI (Render) → Neon Postgres (data + images)

## Where to edit
| Want to change | File |
|---|---|
| Text, timeline, clubs, features, developer link | `frontend/app/config.js` |
| Colours, fonts, animations, loaders | `frontend/app/globals.css` (top `:root`) |
| Public landing page layout | `frontend/app/page.js` |
| Student pages / loader duration | `frontend/app/portal/page.js` |
| What admins can enter | `frontend/app/admin/page.js` → `FIELDS` |
| Loader captions/colours per tab | `frontend/app/components/Loader.js` |
| API rules, validation, security | `backend/main.py` · schema: `backend/migrations/*.sql` |
Loaders appear only on the public page and the student portal. `/admin` never shows one.

## Local run
```bash
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env    # fill DATABASE_URL (Neon pooled), SECRET_KEY, SUPER_EMAIL, SUPER_PASSWORD
uvicorn main:app --env-file .env --port 8000
cd ../frontend && npm install && npm run dev      # http://localhost:3000
```
## Deploy (free)
1. **Neon:** create a project, copy the pooled connection string.
2. **Render:** Web Service from the repo, Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips=*`, Health check `/api/health`. Env: `PYTHON_VERSION=3.12.8`, `PROD=1`, `DATABASE_URL`, `SECRET_KEY` (64 hex), `SUPER_EMAIL`, `SUPER_PASSWORD` (12+ chars).
3. **Vercel:** import the repo, Root Directory `frontend`, env `API_URL=https://<service>.onrender.com`, deploy.
4. Log in as super admin → Admin → WhatsApp groups → add links. Keep Render awake with UptimeRobot on `/api/health` every 5 min.
5. Backups: weekly `pg_dump "<Neon direct string>" -Fc -f backup.dump`.
DB tools: `python manage.py stats | backup FILE | restore FILE | reset-password EMAIL | create-super EMAIL`.

## Security & traffic hardening (v3)
- **Parents' details removed** everywhere; migration `004` permanently deletes the old stored values.
- **Bot defence:** Cloudflare Turnstile on login + register, per-IP registration limit (6/h), per-account login lockout (5/10 min), pending-registration cap (`MAX_PENDING`), 4 MB body cap.
- **Proxy lock:** the backend rejects every request without `PROXY_KEY` (added by `frontend/middleware.js`). Calling the Render URL directly returns 403 (only `/api/health` is open).
- **Sessions** die when a password changes; passwords are 10+ characters.
- **Traffic:** the landing page and the gallery list/images are cached on Vercel's CDN; lists are cached 15 s in memory and cleared on every admin edit.
- **Env vars:** Render: `PROXY_KEY`, `TURNSTILE_SECRET`, `MAX_PENDING`. Vercel: `PROXY_KEY` (same value), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `API_URL`.
- **Under attack?** Vercel dashboard -> Firewall -> turn on *Attack Challenge Mode*.
