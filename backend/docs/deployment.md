# Backend Deployment

## Staging deployment

Use the staging compose stack for a production-like test environment.

```bash
docker-compose -f docker-compose.staging.yml up --build
```

The staging config includes:

- `postgres` for the Medusa database
- `redis` for session/cache support
- `litellm` and `ragflow` for AI services
- `backend` service exposed on `http://localhost:9000`

Update `backend/.env.staging` with your secrets before starting the stack.

## Production deployment

Use the production compose stack for deployment on a VPS.

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

The production stack includes:

- `postgres` with persisted data
- `redis` with persisted data
- `backend_blue` and `backend_green` for blue/green deployment
- `nginx` reverse proxy routing traffic to the active backend

### Production environment file

Copy `.env.example` to `backend/.env.prod` and set production values:

- `NODE_ENV=production`
- `STORE_CORS`
- `ADMIN_CORS`
- `AUTH_CORS`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `DATABASE_URL`
- `HASH_SALT`
- `STOREFRONT_URL`
- `ADMIN_URL`
- `LITELLM_BASE_URL`
- `LITELLM_API_KEY`
- `RAGFLOW_BASE_URL`
- `RAGFLOW_API_KEY`
- `AI_DEFAULT_MODEL`
- `AI_EMBEDDING_MODEL`

### Blue/green deployment

The production compose file defines two backend services:

- `backend_blue`
- `backend_green`

`deploy/bluegreen-deploy.sh` switches traffic safely:

1. Determines the inactive color
2. Builds and starts the inactive backend service
3. Waits for the new backend health endpoint to respond
4. Updates Nginx upstream configuration
5. Reloads Nginx and switches traffic

### Rollback strategy

If a new deployment is bad, use the rollback script:

```bash
bash deploy/rollback.sh
```

Rollback steps:

- bring the previously active backend back online
- update Nginx upstream to the earlier color
- reload Nginx and restore traffic

### GitHub production CI/CD

The GitHub action in `.github/workflows/backend-prod-deploy.yml`:

- builds and validates the backend
- SSHs to your VPS
- fetches `main`
- executes `deploy/bluegreen-deploy.sh`

Required GitHub secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_DEPLOY_PATH`
- `VPS_KNOWN_HOSTS`

## nginx reverse proxy

The now-active backend target is controlled by:

- `deploy/nginx/prod.conf`
- `deploy/nginx/active-backend.conf`

Traffic for `/` and `/admin` is proxied to the active backend service.
