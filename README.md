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

## Application features

The API supports local JWT authentication, invitation-based connections, groups, and
CAD bill splitting:

- `POST /auth/register`, `POST /auth/login`, and protected `GET /auth/me`
- Protected `POST /groups`, `GET /groups`, and `GET /groups/:groupId`
- `POST /friend-invitations`, `POST /groups/:groupId/invitations`, `GET /invitations`,
  and invitation accept/decline `PATCH` endpoints
- `GET /friends`, `POST /bills`, `PATCH /bills/:billId`, `DELETE /bills/:billId`,
  `GET /dashboard`, and `GET /activity`

Creating a group adds only its creator immediately. Friends and additional group
members must accept an in-app invitation before bills can include them.

Copy the documented API values from `services/api/.env.example`, set a long local
`JWT_SECRET`, then apply the Prisma migrations and run `npm run db:generate` before
using auth-backed routes.

The web app reads `VITE_API_URL` from `apps/web/.env` when provided and defaults to `http://localhost:3000`.

### API tests

Password and JWT unit tests can run without a database:

```bash
cd services/api
npm run test:unit
```

Integration tests deliberately require a separate resettable PostgreSQL database. Create `services/api/.env.test` from `.env.test.example`, point both database URLs at that test database, then run:

```bash
npm test
```
