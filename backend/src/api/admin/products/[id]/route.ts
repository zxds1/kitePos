import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { INVENTORY_CONFIG_MODULE } from "../../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../../modules/inventory-config/service"
import { UpdateProductSchema } from "../validator"
import {
  getInventoryConfigByVariantId,
  getNormalizedProductByVariantId,
  getProductAndVariantByVariantId,
  resolveShopId,
} from "../_utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const shopId = resolveShopId(
    req as PosAuthenticatedRequest,
    typeof req.query.shop_id === "string" ? req.query.shop_id : undefined
  )
  const product = await getNormalizedProductByVariantId(req, req.params.id, shopId)

  if (!product) {
    res.status(404).json({
      success: false,
      message: "Product not found",
    })
    return
  }

  res.status(200).json({
    success: true,
    product,
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const parsed = UpdateProductSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const variantId = req.params.id
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const relation = await getProductAndVariantByVariantId(req, variantId)

  if (!relation) {
    res.status(404).json({
      success: false,
      message: "Product not found",
    })
    return
  }

  const inventoryConfig = await getInventoryConfigByVariantId(req, variantId)
  if (!inventoryConfig?.id) {
    res.status(404).json({
      success: false,
      message: "Product inventory config not found",
    })
    return
  }

  const body = parsed.data
  const productMetadata = {
    ...(relation.product.metadata ?? {}),
  }

  if ("category" in body) {
    productMetadata.pos_category = body.category
  }

  if ("cost_per_purchase" in body) {
    productMetadata.pos_cost_per_purchase = body.cost_per_purchase
  }

  const primarySellingUnit = body.selling_units?.[0]
  const hasProductUpdates =
    body.name != null ||
    "category" in body ||
    "cost_per_purchase" in body ||
    primarySellingUnit != null

  if (hasProductUpdates) {
    const update: Record<string, unknown> = {
      metadata: productMetadata,
    }

    if (body.name) {
      update.title = body.name
    }

    if (primarySellingUnit) {
      update.variants = [
        {
          id: variantId,
          prices: [
            {
              amount: primarySellingUnit.price,
              currency_code: "kes",
            },
          ],
        },
      ]
    }

    await updateProductsWorkflow(req.scope).run({
      input: {
        selector: { id: relation.product.id },
        update,
      },
    })
  }

  await inventoryConfigService.updateInventoryConfigs([
    {
      id: inventoryConfig.id,
      ...(body.inventory_type ? { inventory_type: body.inventory_type } : {}),
      ...(body.purchase_unit ? { purchase_unit: body.purchase_unit } : {}),
      ...(body.purchase_value != null ? { purchase_value: body.purchase_value } : {}),
      ...(body.selling_units ? { selling_units: body.selling_units } : {}),
      ...(body.low_stock_threshold != null
        ? { low_stock_threshold: body.low_stock_threshold }
        : {}),
      ...(body.is_active != null ? { is_active: body.is_active } : {}),
    },
  ] as unknown as Record<string, unknown>[])

  const shopId = resolveShopId(req as PosAuthenticatedRequest)
  const product = await getNormalizedProductByVariantId(req, variantId, shopId)

  res.status(200).json({
    success: true,
    product,
  })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const inventoryConfig = await getInventoryConfigByVariantId(req, req.params.id)

  if (!inventoryConfig?.id) {
    res.status(404).json({
      success: false,
      message: "Product not found",
    })
    return
  }

  await inventoryConfigService.updateInventoryConfigs([
    {
      id: inventoryConfig.id,
      is_active: false,
    },
  ] as unknown as Record<string, unknown>[])

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  })
}
