export type OverviewResponse = {
  overview: {
    total_shops: number
    active_shops: number
    inactive_shops: number
    total_sales: number
    total_revenue: number
    mpesa_enabled_shops: number
    payment_breakdown: Record<string, number>
    recent_shops: Array<{
      id: string
      shop_name: string
      region_code: string
      ward_code: string
      is_active: boolean
      created_at: string
    }>
    period: {
      start: string
      end: string
    }
    system_health: {
      api_status: string
      database_status: string
      checked_at: string
    }
  }
}

export type RevenueResponse = {
  trends: Array<{
    bucket: string
    revenue: number
    transactions: number
  }>
  summary: {
    total_revenue: number
    total_transactions: number
    average_transaction_value: number
  }
}

export type ProductAnalyticsResponse = {
  top_products: Array<{
    variant_id: string
    product_name: string
    units_sold: number
    revenue: number
    transaction_count: number
  }>
}

export type ShopRecord = {
  id: string
  shop_name: string
  owner_name?: string | null
  region_code: string
  ward_code: string
  category?: string | null
  is_active: boolean
  accept_mpesa: boolean
  mpesa_phone?: string | null
}

export type CatalogConfigResponse = {
  success: boolean
  path: string
  catalog: {
    version: string
    industries: Array<Record<string, unknown>>
    categories: Array<Record<string, unknown>>
  }
}

export type ObservabilityAlert = {
  id: string
  severity: "info" | "warning" | "critical"
  source: "ai_operation" | "audit_log"
  title: string
  message: string
  occurred_at: string
  shop_id?: string | null
  metadata?: Record<string, unknown> | null
}

export type ObservabilityResponse = {
  summary: {
    ai_operations_24h: number
    ai_failures_24h: number
    ai_slow_ops_24h: number
    avg_latency_ms_24h: number
    total_tokens_24h: number
    total_cost_kes_24h: number
    audit_events_24h: number
    alert_count: number
    system_health: {
      api_status: string
      database_status: string
      checked_at: string
    }
  }
  alerts: ObservabilityAlert[]
  recent_ai_operations: Array<{
    id: string
    shop_id: string
    operation_type: string
    provider: string
    model: string
    total_tokens: number
    cost_kes: number
    latency_ms: number
    success: boolean
    error_message?: string | null
    occurred_at: string
  }>
  recent_audit_events: Array<{
    id: string
    shop_id: string
    actor_user_id?: string | null
    actor_role?: string | null
    action: string
    entity_type: string
    entity_id?: string | null
    location_id?: string | null
    created_at: string
  }>
}

export async function adminRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with ${response.status}`)
  }

  const contentType = response.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await response.json()) as T
  }

  return (await response.blob()) as T
}

export function buildQuery(
  params: Record<string, string | number | undefined | null>
) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
