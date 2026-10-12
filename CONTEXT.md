## Project: NDC Batch 28 Portal (v2, rebuilt)
## Stack: Next.js 14 (app router, JS) + FastAPI + Neon Postgres (images in DB); Vercel + Render
## Current State: build passes; verified via Next proxy: login/cookies, admin CRUD, register, approve, student login, student blocked from admin (403). Not yet viewed in a real browser.
## Active Problem: none
## Key Files: frontend/app/{config.js,globals.css,page.js,portal/page.js,admin/page.js,components/*}, backend/main.py, backend/migrations/
## Decisions Made: Next rewrites proxy /api so cookies stay same-site; loaders only public+student, none in admin; editable content in config.js
## v3: parents' fields dropped (migration 004), Turnstile + PROXY_KEY via middleware.js, rate limits, CDN + in-memory caching, sessions tied to password hash. 5 tests pass; proxy lock verified locally.
## Next Step: replace public/logo.svg with official crest; deploy Neon -> Render -> Vercel; add group links
