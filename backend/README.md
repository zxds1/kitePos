# Storflo Backend

The backend is the operational core for the Storflo stack. It serves:

- POS mobile clients in `uza_pos`
- public storefront generation and publishing flows
- admin and internal operational routes
- partner and export APIs
- AI-assisted extraction and matching flows

This repository is Medusa-based, but it is no longer a generic starter. The source of truth is the Storflo domain model under `src/modules`, `src/api`, and `src/services`.

## Topology

Main backend areas:

- `src/api/auth` and `src/api/pos/auth`
  - OTP, PIN, refresh-token, staff recovery, and POS auth flows
- `src/api/pos`
  - products, sales, restocks, settings, uploads, analytics, staff, stores, AI routes
- `src/api/admin`
  - operational and admin-facing management routes
- `src/api/shops`
  - public storefront and published shop-site endpoints
- `src/modules`
  - persistent business modules such as sale snapshots, suppliers, loyalty, tax, partners, exports
- `src/services`
  - integrations and reusable logic such as AI extraction, Cloudflare R2, billing, loyalty, and tax
- `deploy`
  - blue/green deploy scripts and Nginx config
- `integration-tests/http`
  - HTTP seam tests for POS, analytics, restocks, settings, and partner flows

## Current Responsibilities

The backend currently handles:

- auth and session lifecycle
- shop, staff, branch, and terminal access control
- offline sync ingestion for sales and restocks
- product catalog and inventory config
- public storefront generation and serving
- photo extraction and hybrid product matching
- exports, partner usage logging, and partner billing
- media uploads to Cloudflare R2

## Media Storage

Shared app media is stored in Cloudflare R2.

- Mobile devices still cache media locally for offline work.
- The backend upload route stores the permanent object in R2.
- Persistent records store the returned URL and metadata, not raw image bytes.

Required environment variables:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `CLOUDFLARE_R2_PUBLIC_BASE_URL`
- `CLOUDFLARE_R2_ENDPOINT` optional

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy and fill env:

```bash
cp .env.example .env
```

3. Run the backend:

```bash
npm run dev
```

4. Build to validate production compilation:

```bash
npm run build
```

## Testing

Common checks:

```bash
npm run build
npm test
```

HTTP seam tests live in `integration-tests/http`.

## Deployment

Staging and production use compose-based service topologies plus blue/green deployment tooling.

- staging env: `.env.staging`
- production env: `.env.prod`
- deploy scripts: `deploy/bluegreen-deploy.sh`, `deploy/rollback.sh`

See:

- [docs/deployment.md](/home/sugho/UZApoint/backend/docs/deployment.md)
- [docs/admin.md](/home/sugho/UZApoint/backend/docs/admin.md)
- [docs/observability.md](/home/sugho/UZApoint/backend/docs/observability.md)

## Documentation Index

- [docs/README.md](/home/sugho/UZApoint/backend/docs/README.md)
- [docs/features.md](/home/sugho/UZApoint/backend/docs/features.md)
- [docs/feature-status.md](/home/sugho/UZApoint/backend/docs/feature-status.md)
- [docs/ai-integration.md](/home/sugho/UZApoint/backend/docs/ai-integration.md)

## Notes

- `partner_portal` is a separate surface and should be treated independently when planning app/backend work.
- Not every route exposed in the codebase is product-complete. Use the feature status document before assuming a surface is production-ready.
