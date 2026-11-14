# CLAUDE.md

A marketplace for digital game keys styled like eneba.com, built as an assignment demo. Visitors browse and search the catalog, compare seller offers, pay with a simulated card and see the key on screen.
Laravel 13 (PHP 8.4) API and React 19 + TypeScript 7 SPA on PostgreSQL 16 (Neon). Scope: docs/SPEC.md · design: docs/ARCHITECTURE.md · build order: docs/PLAN.md · visual tokens: docs/DESIGN.md.

## Repo layout
- `frontend/`: Vite + React + TS SPA, deployed to Vercel
- `backend/`: Laravel API, Docker image deployed to Render
- `docs/`: spec, architecture, plan, design tokens, reference screenshots
- `ai-logs/`: exported AI session logs, one file per session

## Commands
No local Docker: the database is Neon. `backend/.env` points `DB_URL` at the Neon `dev` branch and `backend/.env.testing` at the `test` branch (both gitignored; tests refuse to run without `.env.testing`). PHP 8.4 lives in `C:\php84`, ahead of XAMPP's 8.2 on PATH.
```sh
# in backend/
composer install
cp .env.example .env && php artisan key:generate                                  # then set DB_URL (Neon dev)
cp .env.testing.example .env.testing && php artisan key:generate --env=testing   # then set DB_URL (Neon test)
php artisan migrate
php artisan serve                     # http://localhost:8000
php artisan test                      # Pest, against the Neon test branch
vendor/bin/pint --test                # code style (vendor/bin/pint to fix)
# in frontend/
npm ci
npm run dev                           # http://localhost:5173, proxies /api and /sanctum to :8000
npm run test                          # Vitest
npm run lint                          # oxlint (no-explicit-any is an error)
npm run typecheck                     # tsc -b
npm run build
```
Playwright is added in M9.

### Deploy
Merging to `main` deploys both apps: Vercel builds `frontend/`, and Render builds `backend/Dockerfile` and runs `migrate --force` and `optimize` on every container start (Render free has no shell). The frontend has no env vars. Render's env (names only): `APP_KEY`, `APP_URL`, `DB_URL` (Neon `main`, direct), `SESSION_SECURE_COOKIE`, `PORT=8080`; everything else is baked into the image.
```sh
curl -i https://eneba-marketplace-rosy.vercel.app/api/health    # production smoke check through Vercel; expect 200 {"status":"ok","db":"ok"}
```
The first request after 15 idle minutes takes about a minute (Render cold start).

## Conventions
- TypeScript in strict mode, with no `any`. Use `unknown` and narrow it.
- Controllers stay thin: validate with a FormRequest, call a service in `app/Services/`, return a resource. Logic lives in services.
- Prices are integer euro cents (`*_cents`, `int`) everywhere. Format them only for display. Never use floats for money.
- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.

## Rules
- Plan before editing: say which files will change and why, then edit.
- Ask before adding any dependency (composer, npm, Docker image, font files, CDN).
- Run the relevant tests, lint and type-check before saying a task is done. If something fails, show the output.
- Never hardcode homepage content (titles, product IDs, block order) in the frontend. It comes from `GET /api/home`.
- Use only the tokens in docs/DESIGN.md, with no raw hex or pixel values in components. If a token is missing, ask before adding it there.
- Never print, log, commit or ask for secret values (`.env`, `APP_KEY`, DB URLs, API keys). Refer to them by name only.
- When SPEC.md or ARCHITECTURE.md doesn't settle a question, ask instead of guessing.
- When a milestone's Verify step passes, tick its boxes in docs/PLAN.md.
