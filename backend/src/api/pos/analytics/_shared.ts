import type { MedusaRequest } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { ANALYTICS_SNAPSHOT_MODULE } from "../../../modules/analytics-snapshot"
import type AnalyticsSnapshotModuleService from "../../../modules/analytics-snapshot/service"
import { SALE_SNAPSHOT_MODULE } from "../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../modules/sale-snapshot/service"
import { RESTOCK_MODULE } from "../../../modules/restock"
import type RestockModuleService from "../../../modules/restock/service"
import {
  listNormalizedProducts,
  type NormalizedPosProduct,
} from "../../admin/products/_utils"

export const AnalyticsQuerySchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  location_id: z.string().trim().min(1).optional(),
  sales_channel: z
    .enum(["pos", "online", "storefront", "all"])
    .optional()
    .default("all"),
})

type SaleSnapshotRecord = {
  variant_id: string
  payment_method?: string | null
  quantity_sold?: number | { value?: string | number } | null
  price_charged?: number | { value?: string | number } | null
  amount_paid?: number | { value?: string | number } | null
  timestamp?: Date | string | null
}

type RestockRecord = {
  variant_id: string
  quantity_received?: number | { value?: string | number } | null
  total_cost?: number | { value?: string | number } | null
  timestamp?: Date | string | null
}

type ProductCostContext = {
  product: NormalizedPosProduct
  costPerUnit: number
}

type DailyAggregate = {
  date: Date
  revenue: number
  transactions: number
}

function normalizeSalesChannel(channel?: string | null) {
  if (channel === "online") {
    return "storefront"
  }

  return channel ?? "all"
}

export async function buildAnalyticsSummary(
  req: MedusaRequest,
  shopId: string,
  startDate: Date,
  endDate: Date,
  options: {
    locationId?: string | null
    salesChannel?: string | null
  } = {}
) {
  const analyticsSnapshotService: AnalyticsSnapshotModuleService = req.scope.resolve(
    ANALYTICS_SNAPSHOT_MODULE
  )
  const products = await listNormalizedProducts(req, {
    shopId,
    locationId: options.locationId ?? null,
  })
  const productMap = new Map(products.map((product) => [product.variant_id, product]))
  const restocks = await listRestocks(req, shopId, options)
  const snapshots = await listSaleSnapshots(req, shopId, startDate, endDate, options)
  const costByVariant = buildCostByVariant(products, restocks)

  let totalRevenue = 0
  let cashRevenue = 0
  let mpesaRevenue = 0
  let cashTransactions = 0
  let mpesaTransactions = 0
  let estimatedCostOfGoodsSold = 0

  const dailyMap = new Map<string, DailyAggregate>()
  const perVariant = new Map<
    string,
    {
      revenue: number
      unitsSold: number
      transactionCount: number
    }
  >()

  for (const snapshot of snapshots) {
    const revenue = asNumber(snapshot.price_charged)
    const unitsSold = asNumber(snapshot.quantity_sold)
    const variantId = snapshot.variant_id
    const paymentMethod =
      snapshot.payment_method === "mpesa" ? "mpesa" : "cash"
    const date = normalizeDate(snapshot.timestamp)
    const key = dayKey(date)

    totalRevenue += revenue
    estimatedCostOfGoodsSold += unitsSold * (costByVariant.get(variantId)?.costPerUnit ?? 0)

    if (paymentMethod === "cash") {
      cashRevenue += revenue
      cashTransactions += 1
    } else if (paymentMethod === "mpesa") {
      mpesaRevenue += revenue
      mpesaTransactions += 1
    }

    const aggregate = dailyMap.get(key) ?? {
      date,
      revenue: 0,
      transactions: 0,
    }
    aggregate.revenue += revenue
    aggregate.transactions += 1
    dailyMap.set(key, aggregate)

    const productAggregate = perVariant.get(variantId) ?? {
      revenue: 0,
      unitsSold: 0,
      transactionCount: 0,
    }
    productAggregate.revenue += revenue
    productAggregate.unitsSold += unitsSold
    productAggregate.transactionCount += 1
    perVariant.set(variantId, productAggregate)
  }

  const totalTransactions = snapshots.length
  const grossProfitLoss = totalRevenue - estimatedCostOfGoodsSold
  const grossMarginPercent =
    totalRevenue > 0 ? (grossProfitLoss / totalRevenue) * 100 : 0

  let inventoryValue = 0
  for (const product of products) {
    const costPerUnit = costByVariant.get(product.variant_id)?.costPerUnit ?? 0
    inventoryValue += product.stock_remaining * costPerUnit
  }
  const openingInventoryValue = inventoryValue + estimatedCostOfGoodsSold
  const averageInventoryValue = (openingInventoryValue + inventoryValue) / 2
  const inventoryTurnoverRatio =
    averageInventoryValue > 0
      ? estimatedCostOfGoodsSold / averageInventoryValue
      : 0

  const topProducts = Array.from(perVariant.entries())
    .map(([variantId, aggregate]) => {
      const product = productMap.get(variantId)
      const stockRemaining = product?.stock_remaining ?? 0
      const lowStockThreshold = product?.low_stock_threshold ?? 10
      const estimatedCost =
        aggregate.unitsSold * (costByVariant.get(variantId)?.costPerUnit ?? 0)
      const productGrossProfitLoss = aggregate.revenue - estimatedCost
      const productMargin =
        aggregate.revenue > 0
          ? (productGrossProfitLoss / aggregate.revenue) * 100
          : 0

      return {
        variant_id: variantId,
        product_name: product?.name ?? variantId,
        category: product?.category ?? "Other",
        units_sold: round(aggregate.unitsSold),
        revenue: round(aggregate.revenue),
        transaction_count: aggregate.transactionCount,
        stock_remaining: round(stockRemaining),
        is_low_stock: stockRemaining <= lowStockThreshold,
        estimated_cost: round(estimatedCost),
        gross_profit_loss: round(productGrossProfitLoss),
        gross_margin_percent: round(productMargin),
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const stockAlerts = buildStockAlerts(products, restocks)
  const categoryBreakdown = buildCategoryBreakdown(
    Array.from(perVariant.entries()),
    productMap
  )
  const dailyTrends = buildFullDailyTrend(startDate, endDate, dailyMap)

  const payload = {
    sales_summary: {
      period_start: startOfDay(startDate).toISOString(),
      period_end: endOfDay(endDate).toISOString(),
      total_revenue: round(totalRevenue),
      total_transactions: totalTransactions,
      average_transaction_value:
        totalTransactions > 0 ? round(totalRevenue / totalTransactions) : 0,
      cash_revenue: round(cashRevenue),
      mpesa_revenue: round(mpesaRevenue),
      cash_transactions: cashTransactions,
      mpesa_transactions: mpesaTransactions,
      estimated_cost_of_goods_sold: round(estimatedCostOfGoodsSold),
      gross_profit_loss: round(grossProfitLoss),
      gross_margin_percent: round(grossMarginPercent),
      inventory_turnover_ratio: round(inventoryTurnoverRatio),
      inventory_value: round(inventoryValue),
    },
    top_products: topProducts,
    daily_trends: dailyTrends,
    stock_alerts: stockAlerts,
    category_breakdown: categoryBreakdown,
    generated_at: new Date().toISOString(),
  }

  await upsertAnalyticsSnapshot(
    analyticsSnapshotService,
    buildSummaryCacheKey(shopId, startDate, endDate, options),
    {
      shop_id: shopId,
      snapshot_type: "summary",
      variant_id: null,
      range_start: startOfDay(startDate),
      range_end: endOfDay(endDate),
      payload,
      computed_at: new Date(),
    }
  )

  return payload
}

export async function buildProductAnalyticsDetail(
  req: MedusaRequest,
  shopId: string,
  variantId: string,
  startDate: Date,
  endDate: Date,
  options: {
    locationId?: string | null
    salesChannel?: string | null
  } = {}
) {
  const analyticsSnapshotService: AnalyticsSnapshotModuleService = req.scope.resolve(
    ANALYTICS_SNAPSHOT_MODULE
  )
  const products = await listNormalizedProducts(req, {
    shopId,
    locationId: options.locationId ?? null,
  })
  const productMap = new Map(products.map((product) => [product.variant_id, product]))
  const product = productMap.get(variantId)

  if (!product) {
    return null
  }

  const restocks = await listRestocks(req, shopId, options)
  const snapshots = await listSaleSnapshots(req, shopId, startDate, endDate, options)
  const costByVariant = buildCostByVariant(products, restocks)

  const relevantSnapshots = snapshots.filter((snapshot) => snapshot.variant_id === variantId)

  let totalRevenue = 0
  let unitsSold = 0
  let cashRevenue = 0
  let mpesaRevenue = 0
  const dailyMap = new Map<string, DailyAggregate>()

  for (const snapshot of relevantSnapshots) {
    const revenue = asNumber(snapshot.price_charged)
    const quantity = asNumber(snapshot.quantity_sold)
    const paymentMethod =
      snapshot.payment_method === "mpesa" ? "mpesa" : "cash"
    const date = normalizeDate(snapshot.timestamp)
    const key = dayKey(date)

    totalRevenue += revenue
    unitsSold += quantity

    if (paymentMethod === "cash") {
      cashRevenue += revenue
    } else if (paymentMethod === "mpesa") {
      mpesaRevenue += revenue
    }

    const aggregate = dailyMap.get(key) ?? {
      date,
      revenue: 0,
      transactions: 0,
    }
    aggregate.revenue += revenue
    aggregate.transactions += 1
    dailyMap.set(key, aggregate)
  }

  const estimatedCost = unitsSold * (costByVariant.get(variantId)?.costPerUnit ?? 0)
  const grossProfitLoss = totalRevenue - estimatedCost
  const grossMarginPercent =
    totalRevenue > 0 ? (grossProfitLoss / totalRevenue) * 100 : 0
  const averageSellingPrice = unitsSold > 0 ? totalRevenue / unitsSold : 0
  const turnoverBase = unitsSold + product.stock_remaining
  const turnoverRate = turnoverBase > 0 ? unitsSold / turnoverBase : 0

  const lastRestocked = restocks
    .filter((restock) => restock.variant_id === variantId)
    .map((restock) => normalizeDate(restock.timestamp))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  const payload = {
    variant_id: product.variant_id,
    product_name: product.name,
    category: product.category ?? "Other",
    inventory_type: product.inventory_type,
    total_revenue: round(totalRevenue),
    units_sold: round(unitsSold),
    transaction_count: relevantSnapshots.length,
    estimated_cost: round(estimatedCost),
    gross_profit_loss: round(grossProfitLoss),
    gross_margin_percent: round(grossMarginPercent),
    cash_revenue: round(cashRevenue),
    mpesa_revenue: round(mpesaRevenue),
    stock_remaining: round(product.stock_remaining),
    low_stock_threshold: round(product.low_stock_threshold ?? 10),
    is_low_stock: product.stock_remaining <= (product.low_stock_threshold ?? 10),
    daily_trends: buildFullDailyTrend(startDate, endDate, dailyMap),
    last_restocked: (lastRestocked ?? new Date(0)).toISOString(),
    average_selling_price: round(averageSellingPrice),
    turnover_rate: round(turnoverRate),
  }

  await upsertAnalyticsSnapshot(
    analyticsSnapshotService,
    buildProductCacheKey(shopId, variantId, startDate, endDate, options),
    {
      shop_id: shopId,
      snapshot_type: "product",
      variant_id: variantId,
      range_start: startOfDay(startDate),
      range_end: endOfDay(endDate),
      payload,
      computed_at: new Date(),
    }
  )

  return payload
}

async function listSaleSnapshots(
  req: MedusaRequest,
  shopId: string,
  startDate: Date,
  endDate: Date,
  options: {
    locationId?: string | null
    salesChannel?: string | null
  } = {}
) {
  const service: SaleSnapshotModuleService = req.scope.resolve(SALE_SNAPSHOT_MODULE)
  const [snapshots] = await service.listAndCountSaleSnapshots(
    {
      shop_id: shopId,
      ...(options.locationId ? { location_id: options.locationId } : {}),
      ...(options.salesChannel && options.salesChannel !== "all"
        ? { sales_channel: normalizeSalesChannel(options.salesChannel) }
        : {}),
      timestamp: {
        $gte: startOfDay(startDate),
        $lte: endOfDay(endDate),
      },
    },
    {
      take: 10000,
      order: {
        timestamp: "ASC",
      },
    }
  )

  return snapshots as SaleSnapshotRecord[]
}

async function listRestocks(
  req: MedusaRequest,
  shopId: string,
  options: {
    locationId?: string | null
    salesChannel?: string | null
  } = {}
) {
  const service: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
  const [restocks] = await service.listAndCountRestocks(
    {
      shop_id: shopId,
      ...(options.locationId ? { location_id: options.locationId } : {}),
      ...(options.salesChannel && options.salesChannel !== "all"
        ? { sales_channel: normalizeSalesChannel(options.salesChannel) }
        : {}),
    },
    {
      take: 10000,
      order: {
        timestamp: "ASC",
      },
    }
  )

  return restocks as RestockRecord[]
}

function buildCostByVariant(
  products: NormalizedPosProduct[],
  restocks: RestockRecord[]
) {
  const restockTotals = new Map<string, { units: number; cost: number }>()

  for (const restock of restocks) {
    const entry = restockTotals.get(restock.variant_id) ?? { units: 0, cost: 0 }
    entry.units += asNumber(restock.quantity_received)
    entry.cost += asNumber(restock.total_cost)
    restockTotals.set(restock.variant_id, entry)
  }

  const result = new Map<string, ProductCostContext>()
  for (const product of products) {
    const totals = restockTotals.get(product.variant_id)
    const costFromRestock =
      totals && totals.units > 0 ? totals.cost / totals.units : null
    const purchaseValue = product.purchase_value || product.conversion_factor || 0
    const costFromProduct =
      product.cost_per_purchase != null && purchaseValue > 0
        ? product.cost_per_purchase / purchaseValue
        : product.cost_per_purchase ?? 0

    result.set(product.variant_id, {
      product,
      costPerUnit: costFromRestock ?? costFromProduct,
    })
  }

  return result
}

function buildStockAlerts(products: NormalizedPosProduct[], restocks: RestockRecord[]) {
  const lastRestocked = new Map<string, Date>()
  for (const restock of restocks) {
    const current = lastRestocked.get(restock.variant_id)
    const timestamp = normalizeDate(restock.timestamp)
    if (!current || timestamp.getTime() > current.getTime()) {
      lastRestocked.set(restock.variant_id, timestamp)
    }
  }

  return products
    .filter((product) => product.stock_remaining <= (product.low_stock_threshold ?? 10))
    .map((product) => ({
      variant_id: product.variant_id,
      product_name: product.name,
      current_stock: round(product.stock_remaining),
      threshold: round(product.low_stock_threshold ?? 10),
      inventory_type: product.inventory_type,
      last_restocked: (lastRestocked.get(product.variant_id) ?? new Date(0)).toISOString(),
      is_out_of_stock: product.stock_remaining <= 0,
    }))
    .sort((a, b) => {
      if (a.is_out_of_stock !== b.is_out_of_stock) {
        return a.is_out_of_stock ? -1 : 1
      }
      return a.current_stock - b.current_stock
    })
}

function buildCategoryBreakdown(
  perVariant: Array<[string, { revenue: number }]>,
  productMap: Map<string, NormalizedPosProduct>
) {
  const categoryBreakdown = new Map<string, number>()

  for (const [variantId, aggregate] of perVariant) {
    const category = productMap.get(variantId)?.category ?? "Other"
    categoryBreakdown.set(
      category,
      (categoryBreakdown.get(category) ?? 0) + aggregate.revenue
    )
  }

  return Object.fromEntries(
    Array.from(categoryBreakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => [key, round(value)])
  )
}

function buildFullDailyTrend(
  startDate: Date,
  endDate: Date,
  dailyMap: Map<string, DailyAggregate>
) {
  const trends = []
  let cursor = startOfDay(startDate)
  const end = startOfDay(endDate)

  while (cursor.getTime() <= end.getTime()) {
    const key = dayKey(cursor)
    const aggregate = dailyMap.get(key)
    const revenue = aggregate?.revenue ?? 0
    const transactions = aggregate?.transactions ?? 0
    trends.push({
      date: cursor.toISOString(),
      revenue: round(revenue),
      transactions,
      average_transaction_value:
        transactions > 0 ? round(revenue / transactions) : 0,
    })
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  return trends
}

function startOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  )
}

function endOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999
  )
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return startOfDay(value)
  }

  if (typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return startOfDay(parsed)
    }
  }

  return startOfDay(new Date())
}

function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return asNumber((value as { value?: unknown }).value)
  }

  return 0
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function buildSummaryCacheKey(
  shopId: string,
  startDate: Date,
  endDate: Date,
  options: {
    locationId?: string | null
    salesChannel?: string | null
  } = {}
) {
  return `summary:${shopId}:${options.locationId ?? "all"}:${normalizeSalesChannel(options.salesChannel)}:${startOfDay(startDate).toISOString()}:${endOfDay(endDate).toISOString()}`
}

function buildProductCacheKey(
  shopId: string,
  variantId: string,
  startDate: Date,
  endDate: Date,
  options: {
    locationId?: string | null
    salesChannel?: string | null
  } = {}
) {
  return `product:${shopId}:${variantId}:${options.locationId ?? "all"}:${normalizeSalesChannel(options.salesChannel)}:${startOfDay(startDate).toISOString()}:${endOfDay(endDate).toISOString()}`
}

async function upsertAnalyticsSnapshot(
  service: AnalyticsSnapshotModuleService,
  cacheKey: string,
  input: {
    shop_id: string
    snapshot_type: "summary" | "product"
    variant_id: string | null
    range_start: Date
    range_end: Date
    payload: Record<string, unknown>
    computed_at: Date
  }
) {
  const [existing] = await service.listAndCountAnalyticsSnapshots(
    { cache_key: cacheKey },
    { take: 1 }
  )

  if (existing.length > 0) {
    await service.updateAnalyticsSnapshots({
      id: existing[0].id,
      payload: input.payload,
      computed_at: input.computed_at,
      range_start: input.range_start,
      range_end: input.range_end,
      variant_id: input.variant_id,
    })
    return
  }

  await service.createAnalyticsSnapshots({
    id: `analytics_snapshot_${randomUUID()}`,
    cache_key: cacheKey,
    shop_id: input.shop_id,
    snapshot_type: input.snapshot_type,
    variant_id: input.variant_id,
    range_start: input.range_start,
    range_end: input.range_end,
    payload: input.payload,
    computed_at: input.computed_at,
  })
}
