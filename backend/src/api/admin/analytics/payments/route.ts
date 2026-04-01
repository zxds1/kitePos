import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"

const PaymentAnalyticsSchema = z.object({
  shop_id: z.string().optional(),
  region_code: z.string().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  group_by: z.enum(["day", "week", "month", "shop", "region"]).optional().default("day"),
})

type SnapshotRecord = {
  shop_id: string
  payment_method?: string | null
  amount_paid?: number | { value?: string | number } | null
  price_charged?: number | { value?: string | number } | null
  timestamp?: Date | string | null
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const validated = PaymentAnalyticsSchema.safeParse(req.query)

  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const { shop_id, region_code, start_date, end_date, group_by } = validated.data

  const snapshotFilters: Record<string, unknown> = {
    timestamp: {
      $gte: start_date,
      $lte: end_date,
    },
  }

  let allowedShopIds: Set<string> | null = null

  if (shop_id) {
    snapshotFilters.shop_id = shop_id
  } else if (region_code) {
    const shops = await shopService.listShops(
      {},
      {
        take: 10000,
      }
    )
    const regionShops = shops.filter((shop) => shop.region_code === region_code)
    allowedShopIds = new Set(regionShops.map((shop) => shop.id))

    if (allowedShopIds.size === 0) {
      res.status(200).json({
        success: true,
        period: { start_date, end_date },
        filters: { shop_id, region_code, group_by },
        summary: {
          total_sales: 0,
          total_revenue: 0,
          payment_breakdown: {
            cash: { count: 0, total: 0 },
            mpesa: { count: 0, total: 0 },
            card: { count: 0, total: 0 },
            other: { count: 0, total: 0 },
          },
          mpesa_adoption_rate: "0.00%",
        },
      })
      return
    }
  }

  const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
    snapshotFilters,
    {
      take: 10000,
      order: {
        timestamp: "ASC",
      },
    }
  )

  const filteredSnapshots = allowedShopIds
    ? snapshots.filter((snapshot) => allowedShopIds?.has(snapshot.shop_id))
    : snapshots

  const paymentBreakdown = {
    cash: { count: 0, total: 0 },
    mpesa: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
  }

  for (const sale of filteredSnapshots as SnapshotRecord[]) {
    const method =
      sale.payment_method === "mpesa" ||
      sale.payment_method === "card" ||
      sale.payment_method === "other"
        ? sale.payment_method
        : "cash"

    const amount = asNumber(sale.amount_paid) || asNumber(sale.price_charged)
    paymentBreakdown[method].count += 1
    paymentBreakdown[method].total += amount
  }

  const totalSales = filteredSnapshots.length
  const totalRevenue = filteredSnapshots.reduce((sum, sale) => {
    const record = sale as SnapshotRecord
    return sum + (asNumber(record.amount_paid) || asNumber(record.price_charged))
  }, 0)
  const mpesaAdoptionRate =
    totalSales > 0
      ? `${((paymentBreakdown.mpesa.count / totalSales) * 100).toFixed(2)}%`
      : "0.00%"

  res.status(200).json({
    success: true,
    period: { start_date, end_date },
    filters: { shop_id, region_code, group_by },
    summary: {
      total_sales: totalSales,
      total_revenue: totalRevenue,
      payment_breakdown: paymentBreakdown,
      mpesa_adoption_rate: mpesaAdoptionRate,
    },
  })
}
