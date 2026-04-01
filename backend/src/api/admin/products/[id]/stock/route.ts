import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { ADJUSTMENT_MODULE } from "../../../../../modules/adjustment"
import type AdjustmentModuleService from "../../../../../modules/adjustment/service"
import { RESTOCK_MODULE } from "../../../../../modules/restock"
import type RestockModuleService from "../../../../../modules/restock/service"
import { SALE_SNAPSHOT_MODULE } from "../../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../../modules/sale-snapshot/service"
import { calculateServerStock } from "../../../inventory/_utils/stock"
import { AdjustStockSchema } from "../../validator"
import {
  getInventoryConfigByVariantId,
  getNormalizedProductByVariantId,
  getPrimaryStockLevelContext,
  resolveShopId,
  toNumber,
} from "../../_utils"

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const parsed = AdjustStockSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const body = parsed.data
  const shopId = resolveShopId(req as PosAuthenticatedRequest, body.shop_id)
  if (!shopId) {
    res.status(400).json({
      success: false,
      message: "shop_id is required for stock adjustments",
    })
    return
  }

  const variantId = req.params.id
  const inventoryConfig = await getInventoryConfigByVariantId(req, variantId)
  if (!inventoryConfig) {
    res.status(404).json({
      success: false,
      message: "Product not found",
    })
    return
  }

  const currentStock = await calculateServerStock(req.scope, shopId, variantId)
  const quantity = body.quantity
  const purchaseValue = toNumber(inventoryConfig.purchase_value) ?? quantity
  const sellingUnits = Array.isArray(inventoryConfig.selling_units)
    ? inventoryConfig.selling_units
    : []
  const firstSellingUnit =
    sellingUnits.find(
      (unit): unit is Record<string, unknown> =>
        Boolean(unit) && typeof unit === "object"
    ) ?? null

  if (body.adjustment_type === "sale" && quantity > currentStock) {
    res.status(400).json({
      success: false,
      message: "Insufficient stock for sale adjustment",
    })
    return
  }

  if (body.adjustment_type === "restock") {
    const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
    await restockService.createRestocks({
      shop_id: shopId,
      variant_id: variantId,
      quantity_received: quantity,
      purchase_unit_qty: purchaseValue,
      cost_per_unit: 0,
      total_cost: 0,
      source: "manual",
      supplier_name: body.reason ?? "Manual restock",
      conversion_snapshot: {
        inventory_type: inventoryConfig.inventory_type ?? "discrete",
        purchase_unit: inventoryConfig.purchase_unit ?? "Unit",
        purchase_value: purchaseValue,
        selling_units: inventoryConfig.selling_units ?? [],
      },
      timestamp: new Date(),
    } as unknown as Record<string, unknown>)
  } else if (body.adjustment_type === "sale") {
    const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
      SALE_SNAPSHOT_MODULE
    )
    const nextStock = Math.max(0, currentStock - quantity)
    await saleSnapshotService.createSaleSnapshots({
      client_transaction_id: `manual-stock-sale:${shopId}:${variantId}:${Date.now()}`,
      order_id: `manual-stock-order:${Date.now()}`,
      line_item_id: `offline-item:${variantId}:${Date.now()}`,
      shop_id: shopId,
      variant_id: variantId,
      inventory_type: inventoryConfig.inventory_type ?? "discrete",
      unit_sold:
        (typeof firstSellingUnit?.unit === "string" && firstSellingUnit.unit) ||
        inventoryConfig.purchase_unit ||
        "item",
      quantity_sold: quantity,
      conversion_factor_snapshot:
        (typeof firstSellingUnit?.conversion_value === "number" &&
          firstSellingUnit.conversion_value) ||
        1,
      deduction_value: quantity,
      price_charged: 0,
      payment_method: "unknown",
      amount_paid: 0,
      stock_before: currentStock,
      stock_after: nextStock,
      timestamp: new Date(),
    } as unknown as Record<string, unknown>)
  } else {
    const adjustmentService: AdjustmentModuleService = req.scope.resolve(
      ADJUSTMENT_MODULE
    )
    const quantityChange =
      body.adjustment_type === "wastage" || body.adjustment_type === "theft"
        ? -Math.abs(quantity)
        : quantity
    const nextStock = Math.max(0, currentStock + quantityChange)

    await adjustmentService.createAdjustments({
      shop_id: shopId,
      variant_id: variantId,
      adjustment_type: body.adjustment_type,
      quantity_change: quantityChange,
      reason: body.reason ?? body.adjustment_type,
      before_stock: currentStock,
      after_stock: nextStock,
      timestamp: new Date(),
    } as unknown as Record<string, unknown>)
  }

  const stockLevel = await getPrimaryStockLevelContext(req, variantId)
  if (stockLevel.inventory_level_id && stockLevel.inventory_item_id && stockLevel.location_id) {
    const stockRemaining = await calculateServerStock(req.scope, shopId, variantId)
    await updateInventoryLevelsWorkflow(req.scope).run({
      input: {
        updates: [
          {
            id: stockLevel.inventory_level_id,
            inventory_item_id: stockLevel.inventory_item_id,
            location_id: stockLevel.location_id,
            stocked_quantity: stockRemaining,
          },
        ],
      },
    })
  }

  const product = await getNormalizedProductByVariantId(req, variantId, shopId)

  res.status(200).json({
    success: true,
    product,
  })
}
