# Project Onboarding

This repository is a multi-app commerce platform. It has:

- A Medusa backend in `backend/`
- A Next.js storefront / partner portal in `partner-portal/`
- A Flutter POS app in `uza_pos/`

The goal of this document is to help a new engineer understand what each part does, how the pieces connect, and where to start when making changes.

## 1. High-Level Overview

The system is built around a central commerce backend that handles shop data, inventory, orders, AI-assisted features, notifications, compliance records, and supporting business workflows.

The frontend apps consume that backend in different ways:

- `partner-portal/` is the web storefront experience. It renders the public shop-facing UI and interacts with shop data.
- `uza_pos/` is the offline-first mobile POS app used in stores. It is designed for tills, staff login, local device usage, and sync.

The backend also depends on local AI infrastructure:

- `litellm` for model routing
- `ragflow` for document retrieval / RAG flows
- PostgreSQL with `pgvector`
- Redis for caching / background coordination in production-like setups

## 2. What Each App Is For

### Backend

The backend is a Medusa v2 application. It owns the domain logic and most of the business rules.

Key responsibilities:

- shops, locations, terminals, and users
- inventory configuration, stock math, adjustments, restock, and analytics snapshots
- purchase orders and supplier workflows
- loyalty and returns
- tax and compliance records
- notifications and audit logging
- AI-powered generation, embeddings, and RAG routing

### Partner Portal

The web app under `partner-portal/` is a Next.js storefront. The current landing page is a simple branded entry point that links into a demo shop.

Use this app when you need to work on:

- storefront UI
- customer-facing product browsing
- cart and checkout presentation
- shop-specific pages and routing

### UZA POS

The Flutter app under `uza_pos/` is an offline-first POS client.

Use this app when you need to work on:

- cashier workflows
- device login and POS usage
- offline sync
- mobile device behavior
- Android / web / Flutter-specific features

## 3. Backend Structure

The backend follows Medusa conventions:

- `backend/src/api/` - REST API routes
- `backend/src/modules/` - reusable domain modules
- `backend/src/workflows/` - multi-step business workflows
- `backend/src/jobs/` - scheduled background jobs
- `backend/src/subscribers/` - event-driven subscribers
- `backend/src/scripts/` - CLI scripts
- `backend/src/services/` - application services used across the codebase

### Important backend files

- `backend/medusa-config.ts` - Medusa configuration, module registration, CORS, database, Redis
- `backend/package.json` - scripts, dependencies, and runtime entry points
- `backend/.env.example` - the main environment template

## 4. Domain Areas In This Codebase

These are the major business areas exposed by the backend modules and services:

- `shop`, `shop-user`, `shop-location`, `shop-terminal`
- `inventory-config`, `restock`, `adjustment`, `sale-snapshot`, `analytics-snapshot`
- `supplier`, `purchase-order`, `auto-reorder-rule`
- `notification`, `shift-session`, `otp-challenge`
- `loyalty-member`, `loyalty-program`, `loyalty-ledger`, `loyalty-reward`, `loyalty-redemption`
- `return-request`, `return-reason`, `refund-transaction`
- `tax-invoice`, `vat-return`, `tax-report`, `input-vat-record`, `tax-report-run`
- `audit-log`, `data-export-log`, `compliance-logger`
- `ai-config`, `ai-operation-log`, `embedding`, `rag-pgvector`, `rag-router`, `ragflow`

If you are trying to understand a feature, start by locating the module with the same business name.

## 5. Services Worth Knowing

Some of the more important services in `backend/src/services/`:

- `ai.service.ts` - model routing, token usage, cost estimation, and AI logging
- `rag-router.service.ts` - decides whether a query should go through pgvector or Ragflow
- `ragflow.service.ts` - talks to the Ragflow service
- `embedding.service.ts` - embedding-related helpers
- `auto-reorder.service.ts` - evaluates reorder rules and creates purchase orders
- `notification.service.ts` - notification persistence and delivery fallback
- `compliance-logger.service.ts` - logs partner data access and produces compliance summaries
- `inventory-ai.service.ts`, `pricing-ai.service.ts`, `marketing-ai.service.ts`, `returns.service.ts`, `billing.service.ts`

These services are where a lot of cross-module business logic lives.

## 6. Workflows, Jobs, and Events

### Workflows

Workflows in `backend/src/workflows/` are composed of steps and are used for business processes that need clear orchestration and rollback-friendly design.

Use workflows when:

- one operation needs multiple steps
- you need to coordinate reads and writes
- you want the logic to be reusable from routes, jobs, or subscribers

### Jobs

Jobs in `backend/src/jobs/` run on a schedule. The current job set includes auto-reorder checks.

Use jobs for:

- periodic housekeeping
- scheduled sync or alerting
- recurring backend automation

### Subscribers

Subscribers in `backend/src/subscribers/` react to Medusa events.

Use subscribers for:

- event-driven side effects
- ledger updates
- downstream notifications
- audit and analytics capture

## 7. Local Development Setup

### Backend

The backend package uses Node 20+ and npm 10.

Common scripts from `backend/package.json`:

- `npm run dev` - run Medusa in development mode
- `npm run build` - build for production
- `npm run start` - start the built app
- `npm run seed` - seed data via Medusa exec
- `npm run test:unit`
- `npm run test:integration:http`
- `npm run test:integration:modules`

### Local services

The root `docker-compose.yml` starts the local dependencies:

- PostgreSQL with `pgvector`
- a second PostgreSQL instance for Ragflow
- Redis
- LiteLLM
- Ragflow

This is the easiest way to get the backend running with its AI dependencies.

### Environment files

The main backend template is `backend/.env.example`. The most important variables are:

- `DATABASE_URL`
- `REDIS_URL`
- `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`
- `JWT_SECRET`, `COOKIE_SECRET`
- `LITELLM_BASE_URL`, `LITELLM_API_KEY`
- `RAGFLOW_BASE_URL`, `RAGFLOW_WEB_URL`, `RAGFLOW_API_KEY`
- `AI_DEFAULT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_FALLBACK_MODELS`
- `STOREFRONT_URL`, `ADMIN_URL`

The POS app has its own `.env.example` under `uza_pos/`, with app URL, sync, and feature-flag settings.

## 8. Deployment Paths

There are two deployment modes documented in the backend README:

- Staging: `docker-compose.staging.yml`
- Production: `docker-compose.prod.yml`

### Staging

The staging compose stack runs backend dependencies alongside the app using host networking. It is meant to look close to production while staying easy to inspect.

### Production

Production uses blue/green deployment:

- `backend_blue` and `backend_green` are both defined in `docker-compose.prod.yml`
- `deploy/bluegreen-deploy.sh` brings up the inactive color and switches traffic after health checks pass
- `deploy/rollback.sh` can move traffic back if the new release is unhealthy
- Nginx sits in front of the backend on port 80

## 9. How Features Usually Flow

A typical backend feature follows this pattern:

1. Define or extend a module in `backend/src/modules/`
2. Add business logic in a service or workflow
3. Expose the behavior through an API route, subscriber, or job
4. Add tests where possible
5. Update the client app if the UI or sync behavior changes

Examples:

- A stock change may update inventory state, write audit records, and feed analytics snapshots.
- A customer or cashier action may trigger notifications, ledger writes, or AI-assisted processing.
- A supplier reorder may be triggered by a scheduled job, then create purchase orders and notifications.

## 10. Recommended First Read For A New Engineer

If someone is onboarding, they should read these files in this order:

1. `backend/README.md`
2. `backend/medusa-config.ts`
3. `backend/package.json`
4. `backend/src/modules/README.md`
5. `backend/src/workflows/README.md`
6. `backend/src/api/README.md`
7. `backend/src/services/ai.service.ts`
8. `backend/src/services/auto-reorder.service.ts`
9. `backend/src/services/compliance-logger.service.ts`
10. `docs/multi-branch-rollout-checklist.md`

## 11. Practical Notes For Working On This Repo

- Keep Medusa module boundaries in mind. If a feature belongs to a domain area, try to keep its logic near that domain.
- Treat AI and compliance features as cross-cutting concerns. They often touch multiple modules.
- Use the env templates as the source of truth for required runtime config.
- Be careful when changing deployment scripts or compose files, because staging and production do not use the same networking model.
- For POS work, account for offline behavior and sync safety early.

## 12. Short Summary

This repo is a commerce platform with:

- a Medusa backend for core business logic
- a Next.js storefront for web commerce
- a Flutter POS app for in-store operations

The backend is the system of record. The frontend apps are consumers of that backend and should stay aligned with its module and workflow boundaries.

