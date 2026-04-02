import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { asNumber, formatBucketDate } from "../../_utils/admin-analytics"

const RevenueAnalyticsSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  group_by: z.enum(["day", "week", "month"]).optional().default("day"),
})

type SnapshotRecord = {
  timestamp?: Date | string | null
  amount_paid?: number | { value?: string | number } | null
  price_charged?: number | { value?: string | number } | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const validated = RevenueAnalyticsSchema.safeParse(req.query)

  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const endDate = validated.data.end_date ?? new Date()
  const startDate = validated.data.start_date ?? new Date(endDate.getTime() - 30 * 86400000)

  const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
    {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    },
    {
      take: 10000,
      order: { timestamp: "ASC" },
    }
  )

  const grouped = new Map<string, { revenue: number; transactions: number }>()

  for (const snapshot of snapshots as SnapshotRecord[]) {
    const rawDate = snapshot.timestamp ? new Date(snapshot.timestamp) : null
    if (!rawDate || Number.isNaN(rawDate.getTime())) {
      continue
    }

    const key = formatBucketDate(rawDate, validated.data.group_by)
    const current = grouped.get(key) ?? { revenue: 0, transactions: 0 }
    current.revenue +=
      asNumber(snapshot.amount_paid) || asNumber(snapshot.price_charged)
    current.transactions += 1
    grouped.set(key, current)
  }

  const trends = Array.from(grouped.entries())
    .map(([bucket, value]) => ({
      bucket,
      revenue: value.revenue,
      transactions: value.transactions,
    }))
    .sort((left, right) => left.bucket.localeCompare(right.bucket))

  const totalRevenue = trends.reduce((sum, entry) => sum + entry.revenue, 0)
  const totalTransactions = trends.reduce(
    (sum, entry) => sum + entry.transactions,
    0
  )

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    success: true,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    group_by: validated.data.group_by,
    trends,
    summary: {
      total_revenue: totalRevenue,
      total_transactions: totalTransactions,
      average_transaction_value:
        totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
    },
  })
}
