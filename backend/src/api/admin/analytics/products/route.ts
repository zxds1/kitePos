import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { asNumber } from "../../_utils/admin-analytics"
import { listNormalizedProducts } from "../../products/_utils"

const ProductAnalyticsSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

type SnapshotRecord = {
  variant_id: string
  quantity_sold?: number | { value?: string | number } | null
  deduction_value?: number | { value?: string | number } | null
  amount_paid?: number | { value?: string | number } | null
  price_charged?: number | { value?: string | number } | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const validated = ProductAnalyticsSchema.safeParse(req.query)

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

  const [snapshots, products] = await Promise.all([
    saleSnapshotService.listSaleSnapshots(
      {
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      },
      {
        take: 10000,
        order: { timestamp: "DESC" },
      }
    ),
    listNormalizedProducts(req),
  ])

  const productNameByVariant = new Map<string, string>(
    products.map((product) => [product.variant_id, product.name])
  )

  const aggregated = new Map<
    string,
    {
      variant_id: string
      product_name: string
      units_sold: number
      revenue: number
      transaction_count: number
    }
  >()

  for (const snapshot of snapshots as SnapshotRecord[]) {
    const key = snapshot.variant_id
    const current = aggregated.get(key) ?? {
      variant_id: key,
      product_name: productNameByVariant.get(key) ?? "Unknown product",
      units_sold: 0,
      revenue: 0,
      transaction_count: 0,
    }

    current.units_sold +=
      asNumber(snapshot.quantity_sold) || asNumber(snapshot.deduction_value)
    current.revenue +=
      asNumber(snapshot.amount_paid) || asNumber(snapshot.price_charged)
    current.transaction_count += 1
    aggregated.set(key, current)
  }

  const top_products = Array.from(aggregated.values())
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, validated.data.limit)

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    success: true,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    top_products,
  })
}
