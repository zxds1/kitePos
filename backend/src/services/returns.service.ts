import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { RETURN_REQUEST_MODULE } from "../modules/return-request"
import type ReturnRequestModuleService from "../modules/return-request/service"
import { SHOP_MODULE } from "../modules/shop"
import type ShopModuleService from "../modules/shop/service"

export type ReturnReasonCategory =
  | "defective"
  | "expired"
  | "wrong_item"
  | "damaged"
  | "overstock"
  | "customer_change"
  | "other"

export type ReturnItemCondition =
  | "new"
  | "opened"
  | "used"
  | "damaged"
  | "expired"

export type ReturnMethod = "pickup" | "drop_off" | "delivery"

export type ReturnRecord = Record<string, unknown>

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function defaultReturnPolicy() {
  return {
    accepts_returns: true,
    return_window_days: 7,
    conditions: ["with_receipt"],
    restocking_fee_percent: 0,
    refund_methods: ["store_credit", "original_payment"],
    excludes_categories: [] as string[],
  }
}

export function defaultB2BReturnPolicy() {
  return {
    accepts_returns: true,
    return_window_days: 14,
    conditions: ["with_purchase_order"],
    restocking_fee_percent: 0,
    refund_methods: ["store_credit", "bank_transfer"],
    excludes_categories: [] as string[],
  }
}

export function normalizeReturnPolicy(value: unknown) {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const fallback = defaultReturnPolicy()

  return {
    accepts_returns: candidate.accepts_returns !== false,
    return_window_days: Math.max(
      1,
      toNumber(candidate.return_window_days, fallback.return_window_days)
    ),
    conditions: Array.isArray(candidate.conditions)
      ? candidate.conditions.map((item) => String(item)).filter(Boolean)
      : fallback.conditions,
    restocking_fee_percent: Math.max(
      0,
      toNumber(candidate.restocking_fee_percent, fallback.restocking_fee_percent)
    ),
    refund_methods: Array.isArray(candidate.refund_methods)
      ? candidate.refund_methods.map((item) => String(item)).filter(Boolean)
      : fallback.refund_methods,
    excludes_categories: Array.isArray(candidate.excludes_categories)
      ? candidate.excludes_categories.map((item) => String(item)).filter(Boolean)
      : fallback.excludes_categories,
  }
}

export function normalizeB2BReturnPolicy(value: unknown) {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const fallback = defaultB2BReturnPolicy()

  return {
    accepts_returns: candidate.accepts_returns !== false,
    return_window_days: Math.max(
      1,
      toNumber(candidate.return_window_days, fallback.return_window_days)
    ),
    conditions: Array.isArray(candidate.conditions)
      ? candidate.conditions.map((item) => String(item)).filter(Boolean)
      : fallback.conditions,
    restocking_fee_percent: Math.max(
      0,
      toNumber(candidate.restocking_fee_percent, fallback.restocking_fee_percent)
    ),
    refund_methods: Array.isArray(candidate.refund_methods)
      ? candidate.refund_methods.map((item) => String(item)).filter(Boolean)
      : fallback.refund_methods,
    excludes_categories: Array.isArray(candidate.excludes_categories)
      ? candidate.excludes_categories.map((item) => String(item)).filter(Boolean)
      : fallback.excludes_categories,
  }
}

export function generateReturnNumber(prefix: "B2C" | "B2B" | "WEB" | "OPS") {
  return `RET-${prefix}-${Date.now().toString().slice(-10)}`
}

export function shapeReturnRequest(entry: ReturnRecord) {
  return {
    id: String(entry.id),
    return_number:
      typeof entry.return_number === "string" ? entry.return_number : null,
    return_type: String(entry.return_type ?? "manual"),
    shop_id: String(entry.shop_id ?? ""),
    supplier_shop_id:
      typeof entry.supplier_shop_id === "string" ? entry.supplier_shop_id : null,
    customer_id: typeof entry.customer_id === "string" ? entry.customer_id : null,
    order_reference:
      typeof entry.order_reference === "string" ? entry.order_reference : null,
    sale_snapshot_id:
      typeof entry.sale_snapshot_id === "string" ? entry.sale_snapshot_id : null,
    original_sale_id:
      typeof entry.original_sale_id === "string" ? entry.original_sale_id : null,
    original_order_id:
      typeof entry.original_order_id === "string" ? entry.original_order_id : null,
    customer_name:
      typeof entry.customer_name === "string" ? entry.customer_name : null,
    item_name: String(entry.item_name ?? ""),
    items: Array.isArray(entry.items) ? entry.items : [],
    reason: String(entry.reason ?? ""),
    return_reason:
      typeof entry.return_reason === "string"
        ? entry.return_reason
        : String(entry.reason ?? ""),
    return_reason_category: String(entry.return_reason_category ?? "other"),
    item_condition: String(entry.item_condition ?? "new"),
    amount: toNumber(entry.amount),
    total_amount: toNumber(entry.total_amount ?? entry.amount),
    refund_amount: toNumber(entry.refund_amount ?? entry.amount),
    restocking_fee: toNumber(entry.restocking_fee),
    status: String(entry.status ?? "pending"),
    resolution: String(entry.resolution ?? "store_credit"),
    return_method: String(entry.return_method ?? "drop_off"),
    return_shipping_cost: toNumber(entry.return_shipping_cost),
    shipping_paid_by: String(entry.shipping_paid_by ?? "seller"),
    tracking_number:
      typeof entry.tracking_number === "string" ? entry.tracking_number : null,
    notes: typeof entry.notes === "string" ? entry.notes : null,
    customer_notes:
      typeof entry.customer_notes === "string" ? entry.customer_notes : null,
    refund_status: String(entry.refund_status ?? "pending"),
    refund_transaction_id:
      typeof entry.refund_transaction_id === "string"
        ? entry.refund_transaction_id
        : null,
    fraud_score: toNumber(entry.fraud_score),
    fraud_flags: Array.isArray(entry.fraud_flags) ? entry.fraud_flags : [],
    requested_at: entry.requested_at ?? null,
    decided_at: entry.decided_at ?? null,
    approved_at: entry.approved_at ?? null,
    rejected_at: entry.rejected_at ?? null,
    received_at: entry.received_at ?? null,
    refunded_at: entry.refunded_at ?? null,
    rejection_reason:
      typeof entry.rejection_reason === "string" ? entry.rejection_reason : null,
  }
}

export class ReturnsService {
  constructor(private readonly container: MedusaContainer) {}

  private get returns() {
    return this.container.resolve<ReturnRequestModuleService>(RETURN_REQUEST_MODULE)
  }

  private get shops() {
    return this.container.resolve<ShopModuleService>(SHOP_MODULE)
  }

  async getReturnHistory(input: {
    shopId: string
    customerId?: string | null
  }) {
    const filters: Record<string, unknown> = {
      shop_id: input.shopId,
    }
    if (input.customerId) {
      filters.customer_id = input.customerId
    }
    return this.returns.listReturnRequests(filters, {
      take: 100,
      order: { requested_at: "DESC" },
    })
  }

  async calculateFraudScore(input: {
    shopId: string
    customerId?: string | null
    items: Array<Record<string, unknown>>
    returnHistory?: Array<Record<string, unknown>>
  }) {
    const history =
      input.returnHistory ??
      ((await this.getReturnHistory(input)) as Array<Record<string, unknown>>)
    const now = Date.now()
    const recentReturns = history.filter((entry) => {
      const requestedAt =
        entry.requested_at == null ? null : new Date(String(entry.requested_at))
      return (
        requestedAt != null &&
        now - requestedAt.getTime() <= 1000 * 60 * 60 * 24 * 30
      )
    })

    const flags: Array<Record<string, unknown>> = []
    let score = 0

    if (recentReturns.length >= 3) {
      score += 35
      flags.push({ flag: "frequent_returns", severity: "high" })
    } else if (recentReturns.length >= 2) {
      score += 20
      flags.push({ flag: "repeat_returns", severity: "medium" })
    }

    const damagedCount = input.items.filter((item) => {
      const condition = String(item.condition ?? item.item_condition ?? "new")
      return condition === "damaged" || condition === "used"
    }).length
    if (damagedCount > 0) {
      score += Math.min(20, damagedCount * 8)
      flags.push({ flag: "damaged_item_claim", severity: "medium" })
    }

    const quantityTotal = input.items.reduce(
      (sum, item) => sum + toNumber(item.quantity, 1),
      0
    )
    if (quantityTotal >= 5) {
      score += 10
      flags.push({ flag: "high_volume_return", severity: "low" })
    }

    return {
      score: Math.min(100, score),
      flags,
    }
  }

  async getShopPolicies(shopId: string) {
    const [shops] = await this.shops.listAndCountShops({ id: shopId }, { take: 1 })
    const shop = shops[0] as Record<string, unknown> | undefined

    return {
      shop,
      return_policy: normalizeReturnPolicy(shop?.return_policy),
      b2b_return_policy: normalizeB2BReturnPolicy(shop?.b2b_return_policy),
      online_return_policy: normalizeReturnPolicy(shop?.online_return_policy),
    }
  }

  buildCreatePayload(input: {
    shop_id: string
    supplier_shop_id?: string | null
    customer_id?: string | null
    return_type: "b2c_customer" | "b2b_retailer" | "online_order" | "manual"
    return_number?: string | null
    original_sale_id?: string | null
    original_order_id?: string | null
    sale_snapshot_id?: string | null
    order_reference?: string | null
    customer_name?: string | null
    items: Array<Record<string, unknown>>
    total_amount: number
    refund_amount: number
    restocking_fee?: number
    return_reason: string
    return_reason_category: ReturnReasonCategory
    item_condition: ReturnItemCondition
    customer_notes?: string | null
    notes?: string | null
    resolution: string
    return_method: ReturnMethod
    refund_status?: string
    status?: string
    created_by?: string | null
    fraud_score?: number
    fraud_flags?: Array<Record<string, unknown>>
  }) {
    return {
      id: `ret_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: input.shop_id,
      supplier_shop_id: input.supplier_shop_id ?? null,
      customer_id: input.customer_id ?? null,
      original_sale_id: input.original_sale_id ?? null,
      original_order_id: input.original_order_id ?? null,
      sale_snapshot_id: input.sale_snapshot_id ?? null,
      order_reference: input.order_reference ?? null,
      return_number: input.return_number ?? generateReturnNumber("OPS"),
      return_type: input.return_type,
      customer_name: input.customer_name ?? null,
      item_name: String(
        input.items[0]?.product_name ?? input.items[0]?.item_name ?? "Return items"
      ),
      items: input.items,
      reason: input.return_reason,
      return_reason: input.return_reason,
      return_reason_category: input.return_reason_category,
      item_condition: input.item_condition,
      amount: input.total_amount,
      total_amount: input.total_amount,
      refund_amount: input.refund_amount,
      restocking_fee: input.restocking_fee ?? 0,
      status: input.status ?? "pending",
      resolution: input.resolution,
      return_method: input.return_method,
      customer_notes: input.customer_notes ?? null,
      notes: input.notes ?? null,
      created_by: input.created_by ?? null,
      requested_at: new Date(),
      refund_status: input.refund_status ?? "pending",
      fraud_score: input.fraud_score ?? 0,
      fraud_flags: input.fraud_flags ?? [],
    } as Record<string, unknown>
  }
}
