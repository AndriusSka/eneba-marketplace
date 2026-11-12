# CLAUDE.md

A marketplace for digital game keys styled like eneba.com, built as an assignment demo. Visitors browse and search the catalog, compare seller offers, pay with a simulated card and see the key on screen.
Laravel 11 API and React 18 + TypeScript SPA on PostgreSQL 16. Scope: docs/SPEC.md · design: docs/ARCHITECTURE.md · build order: docs/PLAN.md · visual tokens: docs/DESIGN.md.

## Repo layout
- `frontend/`: Vite + React + TS SPA, deployed to Vercel
- `backend/`: Laravel API, Docker image deployed to Render
- `docs/`: spec, architecture, plan, design tokens, reference screenshots
- `ai-logs/`: exported AI session logs, one file per session

## Commands
Placeholders until M0 creates the skeleton. Update this section when it lands.
```sh
docker compose up -d                  # Postgres 16 on localhost:5432
# in backend/
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve                     # http://localhost:8000
php artisan test                      # Pest, needs Postgres running
vendor/bin/pint --test                # code style
# in frontend/
npm ci
npm run dev                           # http://localhost:5173, proxies /api and /sanctum
npm run test                          # Vitest
npm run lint && npx tsc --noEmit && npm run build
npx playwright test                   # end to end, needs both apps running
```

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
