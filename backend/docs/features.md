# Backend Feature Catalog

This document summarizes the core backend features implemented in the UZApoint backend.
It covers the available modules, public API groups, administration features, AI endpoints, and operational capabilities.

## Architecture overview

The backend is built on Medusa and organized into:

- `src/modules/` — business domain modules and persistent models
- `src/api/` — REST API routes for admin, auth, POS, stores, and AI
- `src/services/` — reusable logic and integrations
- `src/admin/` — admin UI routes and pages
- `deploy/` — production deployment scripts, blue/green deployment, Nginx proxy

## Core commerce features

### Shop and locations

- Store and merchant management
- Multi-location shop support
- Terminal registration and POS device management
- Shop user and staff access
- Shop location creation, branch configuration, and regional setup

### Inventory and procurement

- Inventory configuration and stock settings
- Restock workflows and inventory adjustments
- Supplier management
- Purchase order creation and approval
- Auto reorder rules
- Product catalog and POS product matching

### Sales and checkout

- Sale and return processing
- Sale snapshots and audit snapshots
- Shift sessions for cash reconciliation
- Refund transaction management
- Tax invoice issuing and VAT return support
- Payment transaction handling and external payment integration

### Loyalty and rewards

- Loyalty member management
- Loyalty program creation and reward definitions
- Loyalty ledger tracking
- Loyalty redemptions and reward issuance

### Returns and adjustments

- Return request workflows
- Return reasons
- Adjustment records and inventory corrections

### Accounting and reporting

- Analytics snapshot creation and reporting
- Tax report management and run scheduling
- Input VAT record tracking
- Data export logs for financial reconciliation

## Admin and platform features

### Admin dashboards and management

- Admin dashboard overview and system health endpoints
- Admin inventory and POS product management
- Admin shop and location management
- Data export and audit logging

### Authentication and security

- OTP challenge / login pin flows
- Staff access recovery and register shop flows
- Secure auth and cookie configuration via `medusa-config.ts`

### Notifications

- Notification delivery service
- Platform alerts and operational messages

### Partner and integration management

- Partner module for cross-business integrations
- API endpoints for partner data and portal access

## POS / store features

### Point-of-sale operations

- POS inventory listing and product search
- POS order and sale creation
- Shift and session handling
- Store settings and consent management
- Location-specific shop operations

### Public store APIs

- Storefront and public endpoints under `src/api/store/`
- Shop discovery and product listing endpoints

## AI and advanced matching

### AI configuration and logs

- AI settings stored in custom module `ai-config`
- AI operation logging in `ai-operation-log`

### AI endpoints

- `POST /pos/ai/extract-sales` — receipts / sales image extraction
- `POST /pos/ai/match-products` — text product matching
- `POST /pos/ai/hybrid-match` — visual + text matching
- RAGFlow health and insights under `pos/ai/rag`

### AI service integrations

- `backend/src/services/AIExtractionService.ts`
- `backend/src/services/VisualMatchingService.ts`
- `backend/src/services/ProductMatchingService.ts`

## Data and audit features

- Audit log tracking for sensitive actions
- Data export logging
- Sales snapshots and analytics snapshots for reporting
- Health and status endpoints used by deployment and monitoring

## Deployment and operational features

- Production blue/green deployment via `deploy/bluegreen-deploy.sh`
- Rollback process via `deploy/rollback.sh`
- Nginx reverse proxy for active backend routing
- OpenTelemetry instrumentation in `backend/instrumentation.ts`
- Health checks used by deployment automation

## Configuration and environment

### Key configuration files

- `backend/.env.example` — development sample environment
- `backend/.env.staging` — staging environment settings
- `backend/.env.prod` — production environment settings
- `backend/medusa-config.ts` — project config and module registration
- `docker-compose.staging.yml` — staging service topology
- `docker-compose.prod.yml` — production blue/green service topology

### Important environment variables

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `LITELLM_BASE_URL`
- `LITELLM_API_KEY`
- `RAGFLOW_BASE_URL`
- `RAGFLOW_API_KEY`
- `ADMIN_CORS`
- `STORE_CORS`
- `AUTH_CORS`
- `ENABLE_OTEL`

## How to use this catalog

For each feature area, use the following source locations as primary references:

- `src/modules/` — business logic and models
- `src/api/` — endpoint definitions and route handlers
- `src/services/` — shared backend integrations and utilities
- `src/admin/` — admin UI pages and configuration

If you need to inspect a specific feature, start from the matching module or API path then follow into the service and model files.
