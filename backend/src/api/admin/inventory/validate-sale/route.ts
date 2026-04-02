import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import {
  calculateServerStock,
  numbersMatch,
} from "../_utils/stock"
import { getInventoryConfigByVariantId } from "../../products/_utils"
import { AdminValidateSaleRequest } from "./validator"
import {
  calculateDeduction,
  validateStock,
} from "../../../../utils/inventory-math"
import type { InventoryType, SellingUnit } from "../../../../types/inventory"
import { canUseLocation } from "../../../auth/_utils/shop-users"

function normalizeNumber(value: number, precision = 4) {
  return Number(value.toFixed(precision))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const validated = AdminValidateSaleRequest.parse(req.validatedBody)

  if (validated.shop_id !== auth.shop_id) {
    res.status(403).json({ message: "Shop access denied" })
    return
  }

  if (validated.location_id && !canUseLocation(auth, validated.location_id)) {
    res.status(403).json({ message: "Location access denied" })
    return
  }

  const config = await getInventoryConfigByVariantId(
    req,
    validated.variant_id,
    validated.shop_id
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
    validated.variant_id,
    validated.location_id
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
