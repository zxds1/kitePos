# Feature Status

This document is intentionally blunt. It marks what is currently treated as stable, what is usable with caveats, and what still needs follow-through.

## Stable Core

These surfaces are actively wired into the current product flow and should be treated as first-class:

- POS auth
  - OTP, PIN, token refresh, staff recovery
- product catalog and inventory config
- offline sales sync ingestion
- restock creation and sync ingestion
- staff and terminal access control
- Cloudflare R2 media uploads
- sale snapshot persistence
- analytics summary and product analytics APIs
- public storefront generation and serving

## Working But Still Operationally Sensitive

These flows are implemented, but they depend on correct env/config or still need tighter operational guardrails:

- AI extraction and hybrid matching
  - useful and wired, but quality still depends on prompts, inventory quality, and model config
- photo-driven sales capture
  - source media now persists, but downstream audit/reporting surfaces are still catching up
- partner export billing
  - billing seam is implemented and tested, but partner operations should still be treated as controlled rollout work
- tax and loyalty side effects
  - present in the sale pipeline, but they increase operational coupling and need careful regression testing when sale flows change

## Incomplete Or Thinly Surfaced

These areas exist in code but should not be assumed to be fully productized end-to-end:

- some admin pages and operational back-office routes
- some supplier and partner management surfaces
- parts of long-tail reporting and export workflows
- AI-adjacent convenience endpoints that are present but not fully defended by integration coverage

## Deployment Expectations

Production assumptions:

- Postgres configured and reachable
- object storage configured for media
- CORS values aligned with deployed clients
- blue/green deploy scripts used consistently
- health checks and observability enabled

If those are missing, the backend may still boot, but important flows will silently degrade.

## How To Use This Document

Before expanding any backend surface:

1. Confirm whether it is listed under Stable Core or a caveated area.
2. Check test coverage in `integration-tests/http` and service tests.
3. Treat undocumented surfaces as incomplete until verified.
