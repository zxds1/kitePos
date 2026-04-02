import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SALE_SNAPSHOT_MODULE } from "../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { asNumber, toCsv } from "../_utils/admin-analytics"

const DataExportSchema = z.object({
  export_type: z.enum(["shops", "sales"]),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  format: z.enum(["csv"]).optional().default("csv"),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const validated = DataExportSchema.safeParse(req.body)

  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const { export_type } = validated.data
  let rows: Array<Record<string, unknown>> = []
  let fields: string[] = []

  if (export_type === "shops") {
    const shops = await shopService.listShops({}, { take: 10000 })
    rows = shops.map((shop) => ({
      id: shop.id,
      shop_name: shop.shop_name,
      owner_name: shop.owner_name,
      region_code: shop.region_code,
      ward_code: shop.ward_code,
      category: shop.category,
      is_active: shop.is_active,
      accept_mpesa: shop.accept_mpesa,
      created_at: shop.created_at,
    }))
    fields = [
      "id",
      "shop_name",
      "owner_name",
      "region_code",
      "ward_code",
      "category",
      "is_active",
      "accept_mpesa",
      "created_at",
    ]
  } else {
    const endDate = validated.data.end_date ?? new Date()
    const startDate =
      validated.data.start_date ?? new Date(endDate.getTime() - 30 * 86400000)

    const sales = await saleSnapshotService.listSaleSnapshots(
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
    )

    rows = sales.map((sale) => ({
      id: sale.id,
      shop_id: sale.shop_id,
      variant_id: sale.variant_id,
      payment_method: sale.payment_method,
      quantity_sold: asNumber(sale.quantity_sold),
      revenue: asNumber(sale.amount_paid) || asNumber(sale.price_charged),
      timestamp: sale.timestamp,
    }))
    fields = [
      "id",
      "shop_id",
      "variant_id",
      "payment_method",
      "quantity_sold",
      "revenue",
      "timestamp",
    ]
  }

  const csv = toCsv(rows, fields)

  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${export_type}-${Date.now()}.csv`
  )
  res.status(200).send(csv)
}
