# BillCompass web

The responsive BillCompass workspace mirrors the shipped mobile workflows for bills, payment requests, people, groups, activity, and account settings. Public landing and authentication routes remain available alongside the authenticated app.

## Local development

```bash
npm install
npm run dev
```

The browser always calls the same-origin `/api` path. In development, Vite proxies that path to `VITE_DEV_API_PROXY_TARGET` (or `http://localhost:3000` by default). Do not set `VITE_API_URL` for the normal HttpOnly-cookie/CSRF deployment model.

Copy `.env.example` to `.env.local` when a custom API target is needed. Never commit credentials or review-account details.

## Quality checks

```bash
npm run check
npm run test:e2e
```

`npm run check` runs ESLint, Vitest/Testing Library/MSW tests, TypeScript, and the production Vite build. Playwright runs the mocked authenticated route and accessibility matrix at 390, 768, 1024, and 1440 pixels, plus the rich-bill replacement-payload regression.

The optional real-session smoke test uses a local or deployed same-origin target without changing account data:

```bash
BILLCOMPASS_TEST_EMAIL='review@example.com' \
BILLCOMPASS_TEST_PASSWORD='...' \
PLAYWRIGHT_BASE_URL='http://localhost:5173' \
npm run test:e2e -- authenticated-readonly.spec.ts --project=chromium-1440
```

That smoke test verifies login, access-token refresh through the HttpOnly refresh cookie, all primary routes, responsive navigation, browser/API errors, and CSRF-protected logout.

## Primary routes

- `/dashboard`
- `/bills`, `/bills/new`, `/bills/:billId`, `/bills/:billId/edit`
- `/requests`
- `/friends`, `/friends/:friendshipId` (shown as **People**)
- `/groups`, `/groups/:groupId`
- `/activity`
- `/settings`

`/invitations` remains as a compatibility redirect to the invitations tab under People.

## Release notes

Cloudflare Pages should proxy `/api/*` to Cloud Run so cookies remain first-party. Before release, apply the API migrations, run API integration tests against a dedicated disposable test database, and smoke-test the deployed Pages URL. API integration tests intentionally refuse to run without an explicit `services/api/.env.test` because they erase test rows.
