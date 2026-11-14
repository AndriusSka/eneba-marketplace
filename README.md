# eneba-marketplace

An Eneba-style marketplace for digital game keys (Eneba intern assignment 2027).

## Run locally

You need PHP 8.4 (with the `pdo_pgsql` extension), Composer 2, Node 24 and a PostgreSQL 16 database. The project uses two [Neon](https://neon.tech) branches: `dev` for running the app and `test` for the test suite. The tests wipe their database, so never point them at data you want to keep.

**Backend** (`backend/`, http://localhost:8000)

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
# set DB_URL in .env to the dev database's direct connection string (with sslmode=require)
php artisan migrate
php artisan serve
```

**Frontend** (`frontend/`, http://localhost:5173)

```sh
cd frontend
npm ci
npm run dev
```

The Vite dev server proxies `/api` and `/sanctum` to `http://localhost:8000`, so the browser sees one origin, as it does in production. Set `API_PROXY_TARGET` in `frontend/.env.local` if the API runs elsewhere. Open http://localhost:5173: the page shows **API OK** when the API and its database answer.

**Tests and checks**

```sh
# backend
cp .env.testing.example .env.testing
php artisan key:generate --env=testing
# set DB_URL in .env.testing to the test database
php artisan test
vendor/bin/pint --test

# frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

## Docs

- [Spec](docs/SPEC.md): features in scope and out of scope, and why
- [Architecture](docs/ARCHITECTURE.md): stack, data model, API, homepage blocks, search, checkout, deployment
- [Plan](docs/PLAN.md): build milestones with acceptance criteria