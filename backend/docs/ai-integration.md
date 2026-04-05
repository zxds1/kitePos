# Backend AI Integration

## AI routes

The backend includes AI-powered POS services under `/pos/ai`.

### Endpoints

- `POST /pos/ai/extract-sales`
  - extracts structured sales data from images
  - validates input and returns a normalized `sales_data` payload
- `POST /pos/ai/hybrid-match`
  - performs visual + text product matching
  - matches inventory and returns scored candidate products
- `POST /pos/ai/match-products`
  - matches raw product text to inventory products

## Required environment variables

- `LITELLM_BASE_URL`
- `LITELLM_API_KEY`
- `AI_DEFAULT_MODEL`
- `AI_EMBEDDING_MODEL`
- `AI_FALLBACK_MODELS`
- `RAGFLOW_BASE_URL`
- `RAGFLOW_API_KEY`

These variables are used by the AI services in:

- `backend/src/services/AIExtractionService.ts`
- `backend/src/services/VisualMatchingService.ts`
- `backend/src/services/ProductMatchingService.ts`

## Operational notes

- AI routes should be protected by appropriate auth and rate limiting in production.
- The `RAGFlow` service is used for supported AI functionality and should be healthy when AI features are active.
- Keep your AI and RAGFlow API keys secret.

## Monitoring and fallback

If AI services are temporarily unavailable, the backend should fail gracefully and return clear error responses instead of breaking the full platform.

For production readiness:

- monitor `LITELLM_BASE_URL` connectivity
- verify `RAGFLOW_BASE_URL` health
- use logs and OpenTelemetry traces to inspect AI failures
