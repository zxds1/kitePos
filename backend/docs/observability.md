# Backend Observability

## OpenTelemetry

The backend includes OpenTelemetry support via `backend/instrumentation.ts`.

Enable tracing in production with:

```env
ENABLE_OTEL=true
OTEL_EXPORTER=zipkin
OTEL_EXPORTER_ZIPKIN_ENDPOINT=http://localhost:9411/api/v2/spans
```

For OTLP:

```env
OTEL_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

## Health checks

The blue/green deployment scripts expect the backend health endpoint to be healthy before switching traffic.

Use `curl` to verify:

```bash
curl http://localhost:9000/health
```

A successful backend health check means the service is ready to receive production traffic.

## Logging and tracing

- Capture backend logs from Docker containers using `docker compose logs`.
- Use OTEL traces to monitor request flows and identify slow or failing requests.

## Recommended observability practice

- Enable `ENABLE_OTEL=true` in production.
- Pair health checks with Nginx reloads so only healthy backends receive traffic.
- Review AI and database traces for deployment safety during blue/green switches.
