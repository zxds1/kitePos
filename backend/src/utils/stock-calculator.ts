import type { MedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ADJUSTMENT_MODULE } from "../modules/adjustment"
import type AdjustmentModuleService from "../modules/adjustment/service"
import { RESTOCK_MODULE } from "../modules/restock"
import type RestockModuleService from "../modules/restock/service"
import { SALE_SNAPSHOT_MODULE } from "../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../modules/sale-snapshot/service"

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value
  }

  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof (value as { value?: unknown }).value === "string"
  ) {
    return Number((value as { value: string }).value)
  }

  return Number(value ?? 0)
}

export function resolveStockServices(container: MedusaContainer) {
  return {
    adjustmentService: container.resolve<AdjustmentModuleService>(
      ADJUSTMENT_MODULE
    ),
    restockService: container.resolve<RestockModuleService>(RESTOCK_MODULE),
    saleSnapshotService:
      container.resolve<SaleSnapshotModuleService>(SALE_SNAPSHOT_MODULE),
  }
}

export async function calculateServerStock(
  container: MedusaContainer | MedusaRequest["scope"],
  shopId: string,
  variantId: string
): Promise<number> {
  const { adjustmentService, restockService, saleSnapshotService } =
    resolveStockServices(container as MedusaContainer)

  const [restocks, saleSnapshots, adjustments] = await Promise.all([
    restockService.listRestocks({
      shop_id: shopId,
      variant_id: variantId,
    }),
    saleSnapshotService.listSaleSnapshots({
      shop_id: shopId,
      variant_id: variantId,
    }),
    adjustmentService.listAdjustments({
      shop_id: shopId,
      variant_id: variantId,
    }),
  ])

  const inbound = restocks.reduce(
    (sum, restock) => sum + toNumber(restock.quantity_received),
    0
  )
  const outbound = saleSnapshots.reduce(
    (sum, snapshot) => sum + toNumber(snapshot.deduction_value),
    0
  )
  const adjustmentsTotal = adjustments.reduce(
    (sum, adjustment) => sum + toNumber(adjustment.quantity_change),
    0
  )

  return Math.max(0, inbound - outbound + adjustmentsTotal)
}

export function toStockNumber(value: unknown) {
  return toNumber(value)
}
