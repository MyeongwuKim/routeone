# RouteOne API

GraphQL API package for RouteOne.

## Stack

- Apollo Server
- Fastify
- Prisma
- MongoDB
- Local default user for early development

## Local Setup

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`
3. Install dependencies from the repo root

```bash
pnpm install
pnpm --filter api prisma:generate
pnpm dev:api
```

The API server starts at `http://localhost:4000` by default.

- GraphQL: `POST /graphql`
- Health check: `GET /health`

## Auth Shape

Login and authorization are intentionally not wired yet.

Every request uses a local default user, `local@routeone.dev`, so the web app
can call GraphQL without an `Authorization` header during early development.

OAuth tables are still present in Prisma for later Google/Apple login support,
but there is no login mutation exposed in the GraphQL schema right now.
