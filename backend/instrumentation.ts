import { registerOtel } from "@medusajs/medusa"
import { ZipkinExporter } from "@opentelemetry/exporter-zipkin"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

const serviceName = process.env.OTEL_SERVICE_NAME ?? "uza-point-backend"
const exporterType = (process.env.OTEL_EXPORTER ?? "zipkin").toLowerCase()

function createExporter() {
  if (exporterType === "otlp") {
    return new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
    })
  }

  return new ZipkinExporter({
    url: process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT ?? "http://localhost:9411/api/v2/spans",
    serviceName,
  })
}

export function register() {
  if (process.env.ENABLE_OTEL !== "true") {
    return
  }

  registerOtel({
    serviceName,
    exporter: createExporter(),
    instrument: {
      http: true,
      workflows: true,
      query: true,
    },
  })
}
