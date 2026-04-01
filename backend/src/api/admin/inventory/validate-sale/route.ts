import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADJUSTMENT_MODULE } from "../../../../modules/adjustment"
import type AdjustmentModuleService from "../../../../modules/adjustment/service"
import { INVENTORY_CONFIG_MODULE } from "../../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../../modules/inventory-config/service"
import { RESTOCK_MODULE } from "../../../../modules/restock"
import type RestockModuleService from "../../../../modules/restock/service"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import {
  calculateServerStock,
  numbersMatch,
} from "../_utils/stock"
import { AdminValidateSaleRequest } from "./validator"
import {
  calculateDeduction,
  validateStock,
} from "../../../../utils/inventory-math"
import type { InventoryType, SellingUnit } from "../../../../types/inventory"

function normalizeNumber(value: number, precision = 4) {
  return Number(value.toFixed(precision))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const inventoryConfigService: InventoryConfigModuleService =
    req.scope.resolve(INVENTORY_CONFIG_MODULE)
  const restockService: RestockModuleService =
    req.scope.resolve(RESTOCK_MODULE)
  const saleSnapshotService: SaleSnapshotModuleService =
    req.scope.resolve(SALE_SNAPSHOT_MODULE)
  const adjustmentService: AdjustmentModuleService =
    req.scope.resolve(ADJUSTMENT_MODULE)

  const validated = AdminValidateSaleRequest.parse(req.validatedBody)

  const [config] = await inventoryConfigService.listInventoryConfigs(
    { variant_id: validated.variant_id },
    {
      take: 1,
      order: {
        created_at: "DESC",
      },
    }
  )

  if (!config) {
    res.status(404).json({ message: "Inventory config not found for variant" })
    return
  }

  const deductionValue =
    calculateDeduction(
      config.inventory_type as InventoryType,
      validated.unit_sold,
      config.selling_units as unknown as SellingUnit[]
    ) * validated.quantity

  const serverStock = await calculateServerStock(
    req.scope,
    validated.shop_id,
    validated.variant_id
  )

  const currentStock =
    validated.local_stock !== undefined ? validated.local_stock : serverStock
  const allowed = validateStock(currentStock, deductionValue)
  const remainingStock = normalizeNumber(currentStock - deductionValue)
  const lowStockWarning =
    remainingStock < Number(config.low_stock_threshold ?? 0)

  let message: string | undefined

  if (!allowed) {
    message = "Insufficient stock"
  } else if (
    validated.local_stock !== undefined &&
    !numbersMatch(validated.local_stock, serverStock)
  ) {
    message = "Local stock differs from server stock"
  } else if (lowStockWarning) {
    message = "Low stock warning"
  }

  res.status(200).json({
    allowed,
    deduction_value: normalizeNumber(deductionValue),
    current_stock: normalizeNumber(currentStock),
    remaining_stock: remainingStock,
    low_stock_warning: lowStockWarning,
    message,
  })
}
