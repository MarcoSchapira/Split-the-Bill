# Split-the-Bill (EquiSplit)

Full-stack expense-sharing platform.

## Prerequisites

- Node.js 18+

## Local development

### Backend API (port 3000)

```bash
cd services/api
npm install
npm run dev
```

Health check: `GET http://localhost:3000/health`

### Frontend (port 5173)

```bash
cd apps/web
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000` so HttpOnly auth cookies work same-origin during local development.

## Application features

The API supports session-based JWT authentication (HttpOnly cookies in the browser, Bearer tokens for tests/CLI), invitation-based connections, groups, and CAD bill splitting:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and protected `GET /auth/me`
- Protected `POST /groups`, `GET /groups`, and `GET /groups/:groupId`
- `POST /friend-invitations`, `POST /groups/:groupId/invitations`, `GET /invitations`,
  and invitation accept/decline `PATCH` endpoints
- `GET /friends`, `POST /bills`, `PATCH /bills/:billId`, `DELETE /bills/:billId`,
  `GET /dashboard`, and `GET /activity`

Creating a group adds only its creator immediately. Friends and additional group
members must accept an in-app invitation before bills can include them. Invitations
to unregistered emails are stored as pending and delivered when the recipient signs up.

## Environment configuration

Copy values from `services/api/.env.example` and set at minimum:

- `DATABASE_URL` and `DIRECT_URL` (PostgreSQL; Neon recommended)
- `JWT_SECRET` (32+ characters in production; do not use the example default)
- `WEB_ORIGIN` (required in production; e.g. `http://localhost:5173` locally)
- `ACCESS_TOKEN_EXPIRES_IN` (default `15m`) and `REFRESH_TOKEN_EXPIRES_IN` (default `30d`)
- Cookie settings: `COOKIE_SECURE`, `COOKIE_SAME_SITE`
- `TRUST_PROXY=true` when deployed behind a reverse proxy (Vercel, load balancer)
- `ALLOW_AUTH_TOKEN_RESPONSE` — **never** enable in production; set to `true` only in `.env.test` for Bearer-based integration tests

Apply Prisma migrations and run `npm run db:generate` before using auth-backed routes.

The web app defaults to `/api` in both local dev and production. Local dev uses the Vite proxy; production on Cloudflare Pages uses `apps/web/public/_redirects` to proxy `/api` to Cloud Run so HttpOnly cookies stay same-origin. Set `VITE_API_URL` only when intentionally calling the API cross-origin (then use `COOKIE_SAME_SITE=none` on the API).

### Database roles (Neon)

Use two PostgreSQL roles:

| Role | Connection | Purpose |
|------|------------|---------|
| App role | `DATABASE_URL` (pooler) | Runtime API queries; must **not** have `BYPASSRLS` |
| Owner/admin role | `DIRECT_URL` | Prisma migrations, session admin ops, test teardown |

Verify the app role before deploy:

```bash
cd services/api
npm run verify:db-roles
```

### Production checklist

- HTTPS enabled
- Strong `JWT_SECRET` (32+ chars, not the example value)
- `WEB_ORIGIN` matches the deployed frontend origin exactly
- `COOKIE_SECURE=true` in production
- Database role used by `DATABASE_URL` does **not** have `BYPASSRLS` (RLS is enforced)
- `DIRECT_URL` uses a migration/admin role for Prisma migrations and test teardown
- `ALLOW_AUTH_TOKEN_RESPONSE` is unset/false in production
- Run `npm run verify:db-roles` in CI/deploy pipelines

Browser clients receive auth via HttpOnly cookies only (no `token` in login/register JSON). CSRF protection applies to cookie-authenticated mutating requests. Bearer tokens in auth JSON are available only when `ALLOW_AUTH_TOKEN_RESPONSE=true` (tests/CLI).

### API tests

Password and JWT unit tests can run without a database:

```bash
cd services/api
npm run test:unit
```

Integration tests deliberately require a separate resettable PostgreSQL database. Create `services/api/.env.test` from `.env.test.example`, point both database URLs at that test database, then run:

```bash
npm run test:integration          # Bearer suite (requires ALLOW_AUTH_TOKEN_RESPONSE=true)
npm run test:integration:cookie   # Cookie + CSRF suite
npm test                          # unit + Bearer integration
```
