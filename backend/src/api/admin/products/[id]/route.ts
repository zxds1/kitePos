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
import { RAGRouterService } from "../../../../services/rag-router.service"
import { buildProductEmbeddingText } from "../_rag"

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
  const shopId = resolveShopId(req as PosAuthenticatedRequest)
  if (!shopId) {
    res.status(400).json({
      success: false,
      message: "shop_id is required for POS product operations",
    })
    return
  }
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

  const inventoryConfig = await getInventoryConfigByVariantId(req, variantId, shopId)
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

  if ("image_url" in body) {
    productMetadata.pos_image_url = body.image_url
  }

  if ("cost_per_purchase" in body) {
    productMetadata.pos_cost_per_purchase = body.cost_per_purchase
  }
  if ("brand" in body) {
    productMetadata.pos_brand = body.brand
  }
  if ("style_code" in body) {
    productMetadata.pos_style_code = body.style_code
  }
  if ("model_name" in body) {
    productMetadata.pos_model_name = body.model_name
  }

  const primarySellingUnit = body.selling_units?.[0]
  const hasProductUpdates =
    body.name != null ||
    "category" in body ||
    "image_url" in body ||
    "cost_per_purchase" in body ||
    primarySellingUnit != null

  if (hasProductUpdates) {
    const update: Record<string, unknown> = {
      metadata: productMetadata,
    }

    if (body.name) {
      update.title = body.name
    }

    if ("image_url" in body) {
      update.thumbnail = body.image_url
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
      ...("brand" in body ? { brand: body.brand } : {}),
      ...("style_code" in body ? { style_code: body.style_code } : {}),
      ...("size" in body ? { size: body.size } : {}),
      ...("color" in body ? { color: body.color } : {}),
      ...("gender" in body ? { gender: body.gender } : {}),
      ...("material" in body ? { material: body.material } : {}),
      ...("imei" in body ? { imei: body.imei } : {}),
      ...("serial_number" in body ? { serial_number: body.serial_number } : {}),
      ...("model_name" in body ? { model_name: body.model_name } : {}),
      ...("storage_capacity" in body
        ? { storage_capacity: body.storage_capacity }
        : {}),
      ...(body.device_condition ? { device_condition: body.device_condition } : {}),
      ...("warranty_enabled" in body
        ? { warranty_enabled: body.warranty_enabled }
        : {}),
      ...("warranty_months" in body
        ? { warranty_months: body.warranty_months }
        : {}),
      ...("is_returnable" in body
        ? { is_returnable: body.is_returnable }
        : {}),
      ...("return_window_days" in body
        ? { return_window_days: body.return_window_days }
        : {}),
      ...(body.is_active != null ? { is_active: body.is_active } : {}),
    },
  ] as unknown as Record<string, unknown>[])

  const product = await getNormalizedProductByVariantId(req, variantId, shopId)

  if (product) {
    await new RAGRouterService(req.scope).embedEntity({
      entityType: "product",
      entityId: variantId,
      shopId,
      contentText: buildProductEmbeddingText(product as Record<string, unknown>),
      contentMetadata: {
        category: product.category,
        brand: product.brand,
        price: product.selling_units[0]?.price ?? 0,
        stock: product.stock_remaining,
        variant_id: variantId,
      },
    })
  }

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
  const shopId = resolveShopId(req as PosAuthenticatedRequest)
  if (!shopId) {
    res.status(400).json({
      success: false,
      message: "shop_id is required for POS product operations",
    })
    return
  }

  const inventoryConfig = await getInventoryConfigByVariantId(
    req,
    req.params.id,
    shopId
  )

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

  await new RAGRouterService(req.scope).deleteEmbeddings(
    "product",
    req.params.id,
    shopId
  )

  res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  })
}
