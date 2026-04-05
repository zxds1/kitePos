# Backend Getting Started

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose (for staging/prod stacks)
- PostgreSQL and Redis (local or via Docker)

## Install dependencies

```bash
cd backend
npm ci
```

## Environment configuration

Copy the example environment file and update the values:

```bash
cp .env.example .env
```

Then edit `.env` and provide:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `HASH_SALT`
- `STOREFRONT_URL`
- `ADMIN_URL`
- `LITELLM_BASE_URL`
- `LITELLM_API_KEY`
- `RAGFLOW_BASE_URL`
- `RAGFLOW_API_KEY`

## Local development

Run the Medusa backend in development mode:

```bash
npm run dev
```

The backend will start on the configured port and automatically reload on source changes.

## Build for production

```bash
npm run build
```

This command generates the compiled backend assets and prepares the project for deployment.

## Testing

Run unit tests with:

```bash
npm run test:unit
```

Integration test runners are available via:

```bash
npm run test:integration:http
npm run test:integration:modules
```

## Notes

- The backend uses `medusa-config.ts` to load environment variables and configure database, Redis, and HTTP settings.
- If `ENABLE_REDIS=true`, Redis will be enabled in production mode.
