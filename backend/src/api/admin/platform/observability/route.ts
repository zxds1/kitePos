import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AI_OPERATION_LOG_MODULE } from "../../../../modules/ai-operation-log"
import type AIOperationLogModuleService from "../../../../modules/ai-operation-log/service"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"

type AlertSeverity = "info" | "warning" | "critical"

function toIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "string" && value) {
    return value
  }
  return new Date().toISOString()
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function shapeAiOperation(record: Record<string, unknown>) {
  return {
    id: String(record.id),
    shop_id: String(record.shop_id ?? ""),
    operation_type: String(record.operation_type ?? "unknown"),
    provider: String(record.provider ?? "unknown"),
    model: String(record.model ?? "unknown"),
    total_tokens: toNumber(record.total_tokens),
    cost_kes: toNumber(record.cost_kes),
    latency_ms: toNumber(record.latency_ms),
    success: record.success === true,
    error_message:
      typeof record.error_message === "string" ? record.error_message : null,
    occurred_at: toIso(record.occurred_at),
  }
}

function shapeAuditEvent(record: Record<string, unknown>) {
  return {
    id: String(record.id),
    shop_id: String(record.shop_id ?? ""),
    actor_user_id:
      typeof record.actor_user_id === "string" ? record.actor_user_id : null,
    actor_role: typeof record.actor_role === "string" ? record.actor_role : null,
    action: String(record.action ?? "unknown"),
    entity_type: String(record.entity_type ?? "unknown"),
    entity_id: typeof record.entity_id === "string" ? record.entity_id : null,
    location_id:
      typeof record.location_id === "string" ? record.location_id : null,
    created_at: toIso(record.created_at),
  }
}

function buildAlert(input: {
  id: string
  severity: AlertSeverity
  source: "ai_operation" | "audit_log"
  title: string
  message: string
  occurred_at: string
  shop_id?: string | null
  metadata?: Record<string, unknown> | null
}) {
  return input
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const since = new Date()
  since.setHours(since.getHours() - 24)

  const aiService = req.scope.resolve(AI_OPERATION_LOG_MODULE) as unknown as {
    listAndCountAiOperationLogs: (
      filters: Record<string, unknown>,
      config: Record<string, unknown>
    ) => Promise<[Array<Record<string, unknown>>, number]>
  }
  const auditService = req.scope.resolve(AUDIT_LOG_MODULE) as unknown as {
    listAndCountAuditLogs: (
      filters: Record<string, unknown>,
      config: Record<string, unknown>
    ) => Promise<[Array<Record<string, unknown>>, number]>
  }

  const [[aiLogs, aiCount], [auditLogs, auditCount]] = await Promise.all([
    aiService.listAndCountAiOperationLogs(
      { occurred_at: { $gte: since } },
      { take: 100, order: { occurred_at: "DESC" } }
    ),
    auditService.listAndCountAuditLogs(
      { created_at: { $gte: since } },
      { take: 100, order: { created_at: "DESC" } }
    ),
  ])

  const shapedAiLogs = aiLogs.map(shapeAiOperation)
  const shapedAuditLogs = auditLogs.map(shapeAuditEvent)

  const failureAlerts = shapedAiLogs
    .filter((entry) => !entry.success)
    .map((entry) =>
      buildAlert({
        id: `ai-failure:${entry.id}`,
        severity: "critical",
        source: "ai_operation",
        title: `${entry.operation_type} failed`,
        message: entry.error_message ?? "AI operation failed without a message.",
        occurred_at: entry.occurred_at,
        shop_id: entry.shop_id,
        metadata: {
          provider: entry.provider,
          model: entry.model,
          total_tokens: entry.total_tokens,
          cost_kes: entry.cost_kes,
          latency_ms: entry.latency_ms,
        },
      })
    )

  const slowAlerts = shapedAiLogs
    .filter((entry) => entry.success && entry.latency_ms >= 3000)
    .slice(0, 10)
    .map((entry) =>
      buildAlert({
        id: `ai-slow:${entry.id}`,
        severity: "warning",
        source: "ai_operation",
        title: `${entry.operation_type} was slow`,
        message: `Latency reached ${entry.latency_ms} ms on ${entry.model}.`,
        occurred_at: entry.occurred_at,
        shop_id: entry.shop_id,
        metadata: {
          provider: entry.provider,
          model: entry.model,
          total_tokens: entry.total_tokens,
        },
      })
    )

  const auditAlerts = shapedAuditLogs
    .filter((entry) =>
      /(delete|disable|suspend|revoke|reset|adjust|approve|reject)/i.test(
        entry.action
      )
    )
    .slice(0, 10)
    .map((entry) =>
      buildAlert({
        id: `audit:${entry.id}`,
        severity: /delete|suspend|revoke|reset/i.test(entry.action)
          ? "warning"
          : "info",
        source: "audit_log",
        title: `${entry.entity_type} ${entry.action}`,
        message: entry.entity_id
          ? `${entry.entity_type} ${entry.entity_id} was ${entry.action}.`
          : `${entry.entity_type} was ${entry.action}.`,
        occurred_at: entry.created_at,
        shop_id: entry.shop_id,
        metadata: {
          actor_user_id: entry.actor_user_id,
          actor_role: entry.actor_role,
          location_id: entry.location_id,
        },
      })
    )

  const alerts = [...failureAlerts, ...slowAlerts, ...auditAlerts].sort((left, right) =>
    right.occurred_at.localeCompare(left.occurred_at)
  )

  const totalTokens = shapedAiLogs.reduce((sum, entry) => sum + entry.total_tokens, 0)
  const totalCost = shapedAiLogs.reduce((sum, entry) => sum + entry.cost_kes, 0)
  const averageLatency =
    shapedAiLogs.length > 0
      ? Math.round(
          shapedAiLogs.reduce((sum, entry) => sum + entry.latency_ms, 0) /
            shapedAiLogs.length
        )
      : 0

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    success: true,
    summary: {
      ai_operations_24h: aiCount,
      ai_failures_24h: shapedAiLogs.filter((entry) => !entry.success).length,
      ai_slow_ops_24h: shapedAiLogs.filter(
        (entry) => entry.success && entry.latency_ms >= 3000
      ).length,
      avg_latency_ms_24h: averageLatency,
      total_tokens_24h: totalTokens,
      total_cost_kes_24h: totalCost,
      audit_events_24h: auditCount,
      alert_count: alerts.length,
      system_health: {
        api_status: "healthy",
        database_status: "healthy",
        checked_at: new Date().toISOString(),
      },
    },
    alerts,
    recent_ai_operations: shapedAiLogs.slice(0, 20),
    recent_audit_events: shapedAuditLogs.slice(0, 20),
  })
}
