import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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
  getIdempotencyKey,
  getInventoryConfigByVariantId,
  getNormalizedProductByVariantId,
  resolveShopId,
  syncAggregateInventoryLevelForVariant,
  toNumber,
} from "../../_utils"
import { canUseLocation } from "../../../../auth/_utils/shop-users"

async function findExistingRestock(
  restockService: RestockModuleService,
  idempotencyKey: string
) {
  const [restocks] = await restockService.listAndCountRestocks(
    { idempotency_key: idempotencyKey },
    { take: 1 }
  )

  return restocks[0] ?? null
}

async function findExistingSaleReplay(
  saleSnapshotService: SaleSnapshotModuleService,
  shopId: string,
  variantId: string,
  clientTransactionId: string
) {
  const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
    {
      client_transaction_id: clientTransactionId,
      shop_id: shopId,
      variant_id: variantId,
    },
    { take: 1 }
  )

  return snapshots[0] ?? null
}

async function findExistingAdjustment(
  adjustmentService: AdjustmentModuleService,
  reference: string
) {
  const [adjustments] = await adjustmentService.listAndCountAdjustments(
    { reference },
    { take: 1 }
  )

  return adjustments[0] ?? null
}

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

  if (body.location_id && !canUseLocation(auth, body.location_id)) {
    res.status(403).json({
      success: false,
      message: "Location access denied",
    })
    return
  }

  const variantId = req.params.id
  const idempotencyKey = getIdempotencyKey(req)
  const inventoryConfig = await getInventoryConfigByVariantId(req, variantId, shopId)
  if (!inventoryConfig) {
    res.status(404).json({
      success: false,
      message: "Product not found",
    })
    return
  }

  const currentStock = await calculateServerStock(
    req.scope,
    shopId,
    variantId,
    body.location_id
  )
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

  if (idempotencyKey) {
    if (body.adjustment_type === "restock") {
      const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
      const existingRestock = await findExistingRestock(restockService, idempotencyKey)

      if (existingRestock) {
        const product = await getNormalizedProductByVariantId(req, variantId, shopId)
        res.status(200).json({
          success: true,
          product,
        })
        return
      }
    } else if (body.adjustment_type === "sale") {
      const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
        SALE_SNAPSHOT_MODULE
      )
      const existingSnapshot = await findExistingSaleReplay(
        saleSnapshotService,
        shopId,
        variantId,
        idempotencyKey
      )

      if (existingSnapshot) {
        const product = await getNormalizedProductByVariantId(req, variantId, shopId)
        res.status(200).json({
          success: true,
          product,
        })
        return
      }
    } else {
      const adjustmentService: AdjustmentModuleService = req.scope.resolve(
        ADJUSTMENT_MODULE
      )
      const existingAdjustment = await findExistingAdjustment(
        adjustmentService,
        idempotencyKey
      )

      if (existingAdjustment) {
        const product = await getNormalizedProductByVariantId(req, variantId, shopId)
        res.status(200).json({
          success: true,
          product,
        })
        return
      }
    }
  }

  if (body.adjustment_type === "restock") {
    const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
    await restockService.createRestocks({
      shop_id: shopId,
      location_id: body.location_id ?? null,
      variant_id: variantId,
      idempotency_key: idempotencyKey,
      quantity_received: quantity,
      purchase_unit_qty: purchaseValue,
      cost_per_unit: 0,
      total_cost: 0,
      source: "manual",
      supplier_name: body.reason ?? "Manual restock",
      sales_channel: "pos",
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
      client_transaction_id:
        idempotencyKey ?? `manual-stock-sale:${shopId}:${variantId}:${Date.now()}`,
      order_id: `manual-stock-order:${Date.now()}`,
      line_item_id: `offline-item:${variantId}:${Date.now()}`,
      shop_id: shopId,
      location_id: body.location_id ?? null,
      variant_id: variantId,
      sales_channel: "pos",
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
      location_id: body.location_id ?? null,
      variant_id: variantId,
      adjustment_type: body.adjustment_type,
      quantity_change: quantityChange,
      reason: body.reason ?? body.adjustment_type,
      reference: idempotencyKey,
      before_stock: currentStock,
      after_stock: nextStock,
      timestamp: new Date(),
    } as unknown as Record<string, unknown>)
  }

  await syncAggregateInventoryLevelForVariant(req, shopId, variantId)

  const product = await getNormalizedProductByVariantId(req, variantId, shopId)

  res.status(200).json({
    success: true,
    product,
  })
}
