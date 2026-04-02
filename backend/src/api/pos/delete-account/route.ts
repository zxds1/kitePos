import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"
import { z } from "zod"
import { ADJUSTMENT_MODULE } from "../../../modules/adjustment"
import type AdjustmentModuleService from "../../../modules/adjustment/service"
import { ANALYTICS_SNAPSHOT_MODULE } from "../../../modules/analytics-snapshot"
import type AnalyticsSnapshotModuleService from "../../../modules/analytics-snapshot/service"
import { INVENTORY_CONFIG_MODULE } from "../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../modules/inventory-config/service"
import { RESTOCK_MODULE } from "../../../modules/restock"
import type RestockModuleService from "../../../modules/restock/service"
import { SALE_SNAPSHOT_MODULE } from "../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../auth/_utils/jwt"

const DeleteAccountSchema = z.object({
  reason: z.string().min(3).max(255),
  timestamp: z.coerce.date(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth || !auth.shop_id) {
    return
  }

  const validated = DeleteAccountSchema.safeParse(req.body)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
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
  const analyticsSnapshotService: AnalyticsSnapshotModuleService =
    req.scope.resolve(ANALYTICS_SNAPSHOT_MODULE)
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [restocks, snapshots, adjustments, analyticsSnapshots] =
    await Promise.all([
      restockService.listRestocks({ shop_id: auth.shop_id }),
      saleSnapshotService.listSaleSnapshots({ shop_id: auth.shop_id }),
      adjustmentService.listAdjustments({ shop_id: auth.shop_id }),
      analyticsSnapshotService.listAnalyticsSnapshots({ shop_id: auth.shop_id }),
    ])

  const touchedVariantIds = new Set<string>()
  for (const record of [...restocks, ...snapshots, ...adjustments] as Array<{
    variant_id?: string | null
  }>) {
    if (record.variant_id) {
      touchedVariantIds.add(record.variant_id)
    }
  }

  const [allRestocks, allSnapshots, allAdjustments, inventoryConfigs, products] =
    await Promise.all([
      restockService.listRestocks({}),
      saleSnapshotService.listSaleSnapshots({}),
      adjustmentService.listAdjustments({}),
      inventoryConfigService.listInventoryConfigs({ shop_id: auth.shop_id }),
      query.graph({
        entity: "product",
        fields: ["id", "metadata", "variants.id"],
      }),
    ])

  const otherShopVariantIds = new Set<string>()
  for (const record of [
    ...allRestocks,
    ...allSnapshots,
    ...allAdjustments,
  ] as Array<{ shop_id?: string | null; variant_id?: string | null }>) {
    if (
      record.shop_id &&
      record.shop_id !== auth.shop_id &&
      record.variant_id &&
      touchedVariantIds.has(record.variant_id)
    ) {
      otherShopVariantIds.add(record.variant_id)
    }
  }

  const ownedProductIds = new Set<string>()
  const ownedVariantIds = new Set<string>()

  for (const product of (products.data ?? []) as Array<{
    id?: string | null
    metadata?: Record<string, unknown> | null
    variants?: Array<{ id?: string | null } | null> | null
  }>) {
    const variantIds = (product.variants ?? [])
      .map((variant) => variant?.id)
      .filter((value): value is string => Boolean(value))

    const ownedByMetadata = product.metadata?.["pos_shop_id"] === auth.shop_id
    const ownedByExclusiveUsage = variantIds.some(
      (variantId) =>
        touchedVariantIds.has(variantId) && !otherShopVariantIds.has(variantId)
    )

    if (!product.id || (!ownedByMetadata && !ownedByExclusiveUsage)) {
      continue
    }

    ownedProductIds.add(product.id)
    for (const variantId of variantIds) {
      ownedVariantIds.add(variantId)
    }
  }

  const inventoryConfigsToDeactivate = (inventoryConfigs as Array<{
    id?: string | null
    shop_id?: string | null
    variant_id?: string | null
  }>)
    .filter(
      (config) =>
        config.id &&
        config.shop_id === auth.shop_id &&
        config.variant_id &&
        ownedVariantIds.has(config.variant_id)
    ) as Array<{ id: string; variant_id: string }>

  if (analyticsSnapshots.length > 0) {
    await analyticsSnapshotService.deleteAnalyticsSnapshots(
      analyticsSnapshots.map((snapshot) => snapshot.id)
    )
  }

  if (adjustments.length > 0) {
    await adjustmentService.deleteAdjustments(
      adjustments.map((adjustment) => adjustment.id)
    )
  }

  if (snapshots.length > 0) {
    await saleSnapshotService.deleteSaleSnapshots(
      snapshots.map((snapshot) => snapshot.id)
    )
  }

  if (restocks.length > 0) {
    await restockService.deleteRestocks(restocks.map((restock) => restock.id))
  }

  if (inventoryConfigsToDeactivate.length > 0) {
    await inventoryConfigService.updateInventoryConfigs(
      inventoryConfigsToDeactivate.map((config) => ({
        id: config.id,
        is_active: false,
      }))
    )
  }

  if (ownedProductIds.size > 0) {
    await deleteProductsWorkflow(req.scope).run({
      input: {
        ids: Array.from(ownedProductIds),
      },
    })
  }

  await shopService.deleteShops([auth.shop_id])

  res.status(200).json({
    success: true,
    message: "Account deleted successfully",
    deleted_at: validated.data.timestamp.toISOString(),
  })
}
