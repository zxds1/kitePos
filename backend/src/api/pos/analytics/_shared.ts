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
import {
  listShopLocations,
  type ShopLocationRecord,
} from "../_utils/shop-locations"

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
  location_id?: string | null
  payment_method?: string | null
  quantity_sold?: number | { value?: string | number } | null
  price_charged?: number | { value?: string | number } | null
  amount_paid?: number | { value?: string | number } | null
  timestamp?: Date | string | null
}

type RestockRecord = {
  variant_id: string
  location_id?: string | null
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

type BranchAggregate = {
  location_id: string
  location_name: string
  location_code: string
  location_type: string
  total_revenue: number
  total_transactions: number
  average_transaction_value: number
  cash_revenue: number
  mpesa_revenue: number
  cash_transactions: number
  mpesa_transactions: number
  estimated_cost_of_goods_sold: number
  gross_profit_loss: number
  gross_margin_percent: number
  inventory_value: number
  low_stock_count: number
  restock_count: number
  top_product_variant_id: string | null
  top_product_name: string
  top_product_revenue: number
  top_product_units_sold: number
  sales_share_percent: number
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
  const locations = await listShopLocations(req.scope, shopId)
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
  const branchBreakdown = await buildBranchBreakdown({
    req,
    shopId,
    locations,
    selectedLocationId: options.locationId ?? null,
    snapshots,
    restocks,
    totalRevenue,
  })
  const aiInsights = buildAnalyticsInsights({
    salesSummary: {
      totalRevenue,
      grossProfitLoss,
      grossMarginPercent,
      inventoryValue,
      totalTransactions,
    },
    branchBreakdown,
    stockAlerts,
  })

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
    branch_breakdown: branchBreakdown,
    ai_insights: aiInsights,
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

async function buildBranchBreakdown({
  req,
  shopId,
  locations,
  selectedLocationId,
  snapshots,
  restocks,
  totalRevenue,
}: {
  req: MedusaRequest
  shopId: string
  locations: ShopLocationRecord[]
  selectedLocationId: string | null
  snapshots: SaleSnapshotRecord[]
  restocks: RestockRecord[]
  totalRevenue: number
}): Promise<BranchAggregate[]> {
  const scopeLocations = selectedLocationId
    ? locations.filter((location) => location.id === selectedLocationId)
    : locations

  if (scopeLocations.length === 0) {
    return []
  }

  const breakdown = await Promise.all(
    scopeLocations.map(async (location) => {
      const [locationProducts] = await Promise.all([
        listNormalizedProducts(req, {
          shopId,
          locationId: location.id,
        }),
      ])
      const locationSnapshots = snapshots.filter(
        (snapshot) => snapshot.location_id === location.id
      )
      const locationRestocks = restocks.filter(
        (restock) => restock.location_id === location.id
      )

      return buildBranchAggregate(
        location,
        locationProducts,
        locationRestocks,
        locationSnapshots,
        totalRevenue
      )
    })
  )

  return breakdown.sort((a, b) => b.total_revenue - a.total_revenue)
}

function buildBranchAggregate(
  location: ShopLocationRecord,
  products: NormalizedPosProduct[],
  restocks: RestockRecord[],
  snapshots: SaleSnapshotRecord[],
  totalRevenue: number
): BranchAggregate {
  const costByVariant = buildCostByVariant(products, restocks)
  const perVariant = new Map<
    string,
    {
      revenue: number
      unitsSold: number
      transactionCount: number
    }
  >()

  let branchRevenue = 0
  let branchCashRevenue = 0
  let branchMpesaRevenue = 0
  let branchCashTransactions = 0
  let branchMpesaTransactions = 0
  let branchEstimatedCostOfGoodsSold = 0

  for (const snapshot of snapshots) {
    const revenue = asNumber(snapshot.price_charged)
    const unitsSold = asNumber(snapshot.quantity_sold)
    const variantId = snapshot.variant_id
    const paymentMethod =
      snapshot.payment_method === "mpesa" ? "mpesa" : "cash"

    branchRevenue += revenue
    branchEstimatedCostOfGoodsSold +=
      unitsSold * (costByVariant.get(variantId)?.costPerUnit ?? 0)

    if (paymentMethod === "cash") {
      branchCashRevenue += revenue
      branchCashTransactions += 1
    } else if (paymentMethod === "mpesa") {
      branchMpesaRevenue += revenue
      branchMpesaTransactions += 1
    }

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

  let inventoryValue = 0
  let lowStockCount = 0
  for (const product of products) {
    const costPerUnit = costByVariant.get(product.variant_id)?.costPerUnit ?? 0
    inventoryValue += product.stock_remaining * costPerUnit
    if (product.stock_remaining <= (product.low_stock_threshold ?? 10)) {
      lowStockCount += 1
    }
  }

  const topProduct = Array.from(perVariant.entries())
    .map(([variantId, aggregate]) => {
      const product = products.find((item) => item.variant_id === variantId)
      return {
        variantId,
        productName: product?.name ?? variantId,
        revenue: aggregate.revenue,
        unitsSold: aggregate.unitsSold,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)[0]

  const totalTransactions = snapshots.length
  const grossProfitLoss = branchRevenue - branchEstimatedCostOfGoodsSold
  const grossMarginPercent =
    branchRevenue > 0 ? (grossProfitLoss / branchRevenue) * 100 : 0
  const averageTransactionValue =
    totalTransactions > 0 ? branchRevenue / totalTransactions : 0
  const salesSharePercent =
    totalRevenue > 0 ? (branchRevenue / totalRevenue) * 100 : 0

  return {
    location_id: location.id,
    location_name: location.name,
    location_code: location.code,
    location_type: location.location_type ?? "physical",
    total_revenue: round(branchRevenue),
    total_transactions: totalTransactions,
    average_transaction_value: round(averageTransactionValue),
    cash_revenue: round(branchCashRevenue),
    mpesa_revenue: round(branchMpesaRevenue),
    cash_transactions: branchCashTransactions,
    mpesa_transactions: branchMpesaTransactions,
    estimated_cost_of_goods_sold: round(branchEstimatedCostOfGoodsSold),
    gross_profit_loss: round(grossProfitLoss),
    gross_margin_percent: round(grossMarginPercent),
    inventory_value: round(inventoryValue),
    low_stock_count: lowStockCount,
    restock_count: restocks.length,
    top_product_variant_id: topProduct?.variantId ?? null,
    top_product_name: topProduct?.productName ?? "No sales yet",
    top_product_revenue: round(topProduct?.revenue ?? 0),
    top_product_units_sold: round(topProduct?.unitsSold ?? 0),
    sales_share_percent: round(salesSharePercent),
  }
}

function buildAnalyticsInsights({
  salesSummary,
  branchBreakdown,
  stockAlerts,
}: {
  salesSummary: {
    totalRevenue: number
    grossProfitLoss: number
    grossMarginPercent: number
    inventoryValue: number
    totalTransactions: number
  }
  branchBreakdown: BranchAggregate[]
  stockAlerts: Array<{ product_name: string; is_out_of_stock: boolean }>
}) {
  const insights: string[] = []

  if (branchBreakdown.length > 0) {
    const leader = branchBreakdown[0]
    insights.push(
      `${leader.location_name} leads with Ksh ${leader.total_revenue.toFixed(2)} and ${leader.sales_share_percent.toFixed(1)}% of branch sales.`
    )

    const mostPressured = [...branchBreakdown]
      .sort((a, b) => (b.low_stock_count + b.restock_count) - (a.low_stock_count + a.restock_count))[0]
    if (mostPressured) {
      insights.push(
        `${mostPressured.location_name} has the strongest stock pressure with ${mostPressured.low_stock_count} low-stock items and ${mostPressured.restock_count} restocks.`
      )
    }

    const spread =
      branchBreakdown.length > 1
        ? leader.total_revenue -
          branchBreakdown[branchBreakdown.length - 1].total_revenue
        : 0
    if (spread > 0) {
      insights.push(
        `Revenue is spread across ${branchBreakdown.length} branch${branchBreakdown.length === 1 ? '' : 'es'} with a Ksh ${spread.toFixed(2)} gap between the top and bottom branch.`
      )
    }
  }

  if (salesSummary.grossMarginPercent < 20) {
    insights.push(
      `Gross margin is at ${salesSummary.grossMarginPercent.toFixed(1)}%. Review pricing or procurement costs.`
    )
  } else {
    insights.push(
      `Gross profit is positive at Ksh ${salesSummary.grossProfitLoss.toFixed(2)} for this period.`
    )
  }

  const outOfStockCount = stockAlerts.filter((item) => item.is_out_of_stock).length
  if (outOfStockCount > 0) {
    insights.push(
      `${outOfStockCount} item${outOfStockCount === 1 ? '' : 's'} are out of stock and should be restocked.`
    )
  }

  if (salesSummary.totalTransactions > 0) {
    insights.push(
      `The shop handled ${salesSummary.totalTransactions} orders and held ${salesSummary.inventoryValue.toFixed(2)} in tracked stock value.`
    )
  }

  return insights.slice(0, 4)
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
  const trends: Array<{
    date: string
    revenue: number
    transactions: number
    average_transaction_value: number
  }> = []
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
