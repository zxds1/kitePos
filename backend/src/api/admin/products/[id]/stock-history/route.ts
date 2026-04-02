import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { ADJUSTMENT_MODULE } from "../../../../../modules/adjustment"
import type AdjustmentModuleService from "../../../../../modules/adjustment/service"
import { RESTOCK_MODULE } from "../../../../../modules/restock"
import type RestockModuleService from "../../../../../modules/restock/service"
import { SALE_SNAPSHOT_MODULE } from "../../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../../modules/sale-snapshot/service"
import { resolveShopId, toNumber } from "../../_utils"

type StockHistoryItem = {
  id: string
  type: string
  quantity: number
  reason: string
  date: string
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const variantId = req.params.id
  const locationId =
    typeof req.query.location_id === "string" ? req.query.location_id : undefined
  const shopId = resolveShopId(
    req as PosAuthenticatedRequest,
    typeof req.query.shop_id === "string" ? req.query.shop_id : undefined
  )

  if (!shopId) {
    res.status(400).json({
      success: false,
      message: "shop_id is required for stock history",
    })
    return
  }

  const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const adjustmentService: AdjustmentModuleService = req.scope.resolve(
    ADJUSTMENT_MODULE
  )

  const [restocks, sales, adjustments] = await Promise.all([
    restockService.listRestocks(
      {
        shop_id: shopId,
        ...(locationId ? { location_id: locationId } : {}),
        variant_id: variantId,
      },
      { take: 200, order: { timestamp: "DESC" } }
    ),
    saleSnapshotService.listSaleSnapshots(
      {
        shop_id: shopId,
        ...(locationId ? { location_id: locationId } : {}),
        variant_id: variantId,
      },
      { take: 200, order: { timestamp: "DESC" } }
    ),
    adjustmentService.listAdjustments(
      {
        shop_id: shopId,
        ...(locationId ? { location_id: locationId } : {}),
        variant_id: variantId,
      },
      { take: 200, order: { timestamp: "DESC" } }
    ),
  ])

  const movements: StockHistoryItem[] = [
    ...restocks.map((restock) => ({
      id: String(restock.id),
      type: "restock",
      quantity: toNumber(restock.quantity_received) ?? 0,
      reason:
        (typeof restock.supplier_name === "string" && restock.supplier_name) ||
        (typeof restock.source === "string" && restock.source) ||
        "Restock",
      date: new Date(String(restock.timestamp)).toISOString(),
    })),
    ...sales.map((sale) => ({
      id: String(sale.id),
      type: "sale",
      quantity: -(toNumber(sale.deduction_value) ?? 0),
      reason:
        (typeof sale.unit_sold === "string" && sale.unit_sold)
          ? `Sold ${sale.unit_sold}`
          : "Sale",
      date: new Date(String(sale.timestamp)).toISOString(),
    })),
    ...adjustments.map((adjustment) => ({
      id: String(adjustment.id),
      type: String(adjustment.adjustment_type ?? "adjustment"),
      quantity: toNumber(adjustment.quantity_change) ?? 0,
      reason:
        (typeof adjustment.reason === "string" && adjustment.reason) ||
        String(adjustment.adjustment_type ?? "Adjustment"),
      date: new Date(String(adjustment.timestamp)).toISOString(),
    })),
  ].sort((left, right) => right.date.localeCompare(left.date))

  res.status(200).json({
    success: true,
    movements,
  })
}
