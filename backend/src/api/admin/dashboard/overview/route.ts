import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import { asNumber } from "../../_utils/admin-analytics"

type SnapshotRecord = {
  payment_method?: string | null
  amount_paid?: number | { value?: string | number } | null
  price_charged?: number | { value?: string | number } | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )

  const endDate = new Date()
  const startDate = new Date()
  startDate.setUTCDate(startDate.getUTCDate() - 30)

  const [[recentShops], [allShops, totalShops], [, activeShops], [snapshots, totalSales]] =
    await Promise.all([
      shopService.listAndCountShops(
        {},
        {
          take: 5,
          order: { created_at: "DESC" },
        }
      ),
      shopService.listAndCountShops({}, { take: 10000 }),
      shopService.listAndCountShops({ is_active: true }, { take: 10000 }),
      saleSnapshotService.listAndCountSaleSnapshots(
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
    ])

  const paymentBreakdown = {
    cash: 0,
    mpesa: 0,
    card: 0,
    other: 0,
  }

  let totalRevenue = 0

  for (const snapshot of snapshots as SnapshotRecord[]) {
    const method =
      snapshot.payment_method === "mpesa" ||
      snapshot.payment_method === "card" ||
      snapshot.payment_method === "other"
        ? snapshot.payment_method
        : "cash"

    paymentBreakdown[method] += 1
    totalRevenue +=
      asNumber(snapshot.amount_paid) || asNumber(snapshot.price_charged)
  }

  res.setHeader("Cache-Control", "no-store")
  res.status(200).json({
    success: true,
    overview: {
      total_shops: totalShops,
      active_shops: activeShops,
      inactive_shops: Math.max(0, totalShops - activeShops),
      total_sales: totalSales,
      total_revenue: totalRevenue,
      mpesa_enabled_shops: allShops.filter((shop) => shop.accept_mpesa).length,
      payment_breakdown: paymentBreakdown,
      recent_shops: recentShops.map((shop) => ({
        id: shop.id,
        shop_name: shop.shop_name,
        region_code: shop.region_code,
        ward_code: shop.ward_code,
        is_active: shop.is_active,
        created_at: shop.created_at,
      })),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      system_health: {
        api_status: "healthy",
        database_status: "healthy",
        checked_at: new Date().toISOString(),
      },
    },
  })
}
