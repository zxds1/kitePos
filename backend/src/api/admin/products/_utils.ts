import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import { INVENTORY_CONFIG_MODULE } from "../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../modules/inventory-config/service"
import { calculateServerStock } from "../inventory/_utils/stock"

export type ProductQueryRecord = {
  id: string
  title?: string | null
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
  categories?: Array<{ name?: string | null } | null> | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
  variants?: Array<ProductVariantQueryRecord | null> | null
}

export type ProductVariantQueryRecord = {
  id: string
  title?: string | null
  thumbnail?: string | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
  price_set?: {
    prices?: Array<{
      amount?: number | null
      currency_code?: string | null
    } | null> | null
  } | null
  inventory?: Array<{
    id?: string | null
    location_levels?: Array<{
      id?: string | null
      location_id?: string | null
      stocked_quantity?: number | null
    } | null> | null
  } | null> | null
}

export type InventoryConfigRecord = {
  id?: string
  variant_id: string
  inventory_type?: string | null
  purchase_unit?: string | null
  purchase_value?: number | { value?: string } | null
  selling_units?: unknown
  low_stock_threshold?: number | { value?: string } | null
  is_active?: boolean | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
}

export type NormalizedPosProduct = {
  id: string
  variant_id: string
  name: string
  category: string | null
  cost_per_purchase: number | null
  inventory_type: string
  purchase_unit: string | null
  purchase_value: number | null
  selling_units: Array<Record<string, unknown>>
  conversion_factor: number
  stock_remaining: number
  low_stock_threshold: number | null
  is_active: boolean
  image_url: string | null
  last_synced_at: string
  created_at: string | null
  updated_at: string | null
}

export async function listNormalizedProducts(
  req: MedusaRequest,
  options: {
    shopId?: string | null
    variantId?: string
  } = {}
): Promise<NormalizedPosProduct[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )

  const [{ data }, inventoryConfigs] = await Promise.all([
    query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "thumbnail",
        "metadata",
        "categories.name",
        "created_at",
        "updated_at",
        "variants.id",
        "variants.title",
        "variants.thumbnail",
        "variants.created_at",
        "variants.updated_at",
        "variants.price_set.prices.amount",
        "variants.price_set.prices.currency_code",
        "variants.inventory.id",
        "variants.inventory.location_levels.id",
        "variants.inventory.location_levels.location_id",
        "variants.inventory.location_levels.stocked_quantity",
      ],
    }),
    inventoryConfigService.listInventoryConfigs(
      {},
      {
        take: 1000,
        order: { created_at: "DESC" },
      }
    ),
  ])

  const inventoryConfigByVariant = new Map<string, InventoryConfigRecord>()

  for (const config of inventoryConfigs as unknown as InventoryConfigRecord[]) {
    if (!inventoryConfigByVariant.has(config.variant_id)) {
      inventoryConfigByVariant.set(config.variant_id, config)
    }
  }

  const products = await Promise.all(
    (data as ProductQueryRecord[]).flatMap((product) =>
      (product.variants ?? [])
        .filter(
          (variant): variant is ProductVariantQueryRecord =>
            Boolean(variant?.id) &&
            (!options.variantId || variant?.id === options.variantId)
        )
        .map(async (variant) => {
          const inventoryConfig = inventoryConfigByVariant.get(variant.id)
          const stockRemaining = options.shopId
            ? await calculateServerStock(req.scope, options.shopId, variant.id)
            : getVariantInventoryStock(variant)

          return {
            id: product.id,
            variant_id: variant.id,
            name: buildProductName(product, variant),
            category: getCategoryName(product),
            cost_per_purchase: getMetadataNumber(
              product.metadata,
              "pos_cost_per_purchase"
            ),
            inventory_type: inventoryConfig?.inventory_type ?? "discrete",
            purchase_unit: inventoryConfig?.purchase_unit ?? null,
            purchase_value: toNumber(inventoryConfig?.purchase_value),
            selling_units: normalizeSellingUnits(
              inventoryConfig?.selling_units,
              variant
            ),
            conversion_factor: getConversionFactor(
              inventoryConfig?.selling_units
            ),
            stock_remaining: stockRemaining,
            low_stock_threshold: toNumber(inventoryConfig?.low_stock_threshold),
            is_active: inventoryConfig?.is_active ?? true,
            image_url: variant.thumbnail ?? product.thumbnail ?? null,
            last_synced_at: new Date().toISOString(),
            created_at: toIsoString(
              inventoryConfig?.created_at ??
                variant.created_at ??
                product.created_at
            ),
            updated_at: toIsoString(
              inventoryConfig?.updated_at ??
                variant.updated_at ??
                product.updated_at
            ),
          }
        })
    )
  )

  return products
}

export async function getNormalizedProductByVariantId(
  req: MedusaRequest,
  variantId: string,
  shopId?: string | null
) {
  const products = await listNormalizedProducts(req, { shopId, variantId })
  return products[0] ?? null
}

export async function getInventoryConfigByVariantId(
  req: MedusaRequest,
  variantId: string
) {
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const [config] = await inventoryConfigService.listInventoryConfigs(
    { variant_id: variantId },
    { take: 1 }
  )

  return (config as InventoryConfigRecord | undefined) ?? null
}

export async function getProductAndVariantByVariantId(
  req: MedusaRequest,
  variantId: string
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "thumbnail",
      "metadata",
      "created_at",
      "updated_at",
      "variants.id",
      "variants.title",
      "variants.inventory.id",
      "variants.inventory.location_levels.id",
      "variants.inventory.location_levels.location_id",
      "variants.inventory.location_levels.stocked_quantity",
    ],
  })

  for (const product of data as ProductQueryRecord[]) {
    for (const variant of product.variants ?? []) {
      if (variant?.id === variantId) {
        return {
          product,
          variant,
        }
      }
    }
  }

  return null
}

export function resolveShopId(req: MedusaRequest & { auth_context?: { shop_id?: string | null } }, explicitShopId?: string) {
  if (explicitShopId && explicitShopId.trim().length > 0) {
    return explicitShopId.trim()
  }

  if (req.auth_context?.shop_id && req.auth_context.shop_id.trim().length > 0) {
    return req.auth_context.shop_id.trim()
  }

  return null
}

export async function getPrimaryStockLevelContext(req: MedusaRequest, variantId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationService = req.scope.resolve(Modules.STOCK_LOCATION)
  const [stockLocation] = await stockLocationService.listStockLocations({}, { take: 1 })

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "variants.id",
      "variants.inventory.id",
      "variants.inventory.location_levels.id",
      "variants.inventory.location_levels.location_id",
      "variants.inventory.location_levels.stocked_quantity",
    ],
  })

  for (const product of data as ProductQueryRecord[]) {
    for (const variant of product.variants ?? []) {
      if (variant?.id !== variantId) {
        continue
      }

      for (const inventoryItem of variant.inventory ?? []) {
        const level = (inventoryItem?.location_levels ?? []).find((candidate) => {
          if (!stockLocation?.id) {
            return Boolean(candidate?.id)
          }

          return candidate?.location_id === stockLocation.id
        })

        return {
          inventory_item_id: inventoryItem?.id ?? null,
          inventory_level_id: level?.id ?? null,
          location_id: level?.location_id ?? stockLocation?.id ?? null,
          stocked_quantity: Number(level?.stocked_quantity ?? 0),
        }
      }
    }
  }

  return {
    inventory_item_id: null,
    inventory_level_id: null,
    location_id: stockLocation?.id ?? null,
    stocked_quantity: 0,
  }
}

export function buildProductName(
  product: ProductQueryRecord,
  variant: ProductVariantQueryRecord
) {
  const productTitle = product.title?.trim() || "Unnamed Product"
  const variantTitle = variant.title?.trim()

  if (!variantTitle || variantTitle === "Default Variant") {
    return productTitle
  }

  if (variantTitle.toLowerCase() === productTitle.toLowerCase()) {
    return productTitle
  }

  return `${productTitle} ${variantTitle}`.trim()
}

export function getCategoryName(product: ProductQueryRecord) {
  for (const category of product.categories ?? []) {
    if (category?.name) {
      return category.name
    }
  }

  const metadataCategory = product.metadata?.["pos_category"]
  return typeof metadataCategory === "string" && metadataCategory.trim().length > 0
    ? metadataCategory
    : null
}

export function getMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  if (!metadata) {
    return null
  }

  return toNumber(metadata[key])
}

export function getVariantInventoryStock(variant: ProductVariantQueryRecord) {
  return (variant.inventory ?? []).reduce((inventorySum, inventoryItem) => {
    const locationLevelTotal = (inventoryItem?.location_levels ?? []).reduce(
      (levelSum, level) => levelSum + Number(level?.stocked_quantity ?? 0),
      0
    )

    return inventorySum + locationLevelTotal
  }, 0)
}

export function normalizeSellingUnits(
  rawSellingUnits: unknown,
  variant: ProductVariantQueryRecord
) {
  if (Array.isArray(rawSellingUnits) && rawSellingUnits.length > 0) {
    return rawSellingUnits as Array<Record<string, unknown>>
  }

  const defaultPrice = variant.price_set?.prices?.find(
    (price) => price?.amount != null
  )?.amount

  if (defaultPrice == null) {
    return []
  }

  return [
    {
      unit: "item",
      price: defaultPrice,
      conversion_value: 1,
    },
  ]
}

export function getConversionFactor(rawSellingUnits: unknown) {
  if (!Array.isArray(rawSellingUnits) || rawSellingUnits.length === 0) {
    return 1
  }

  const firstUnit = rawSellingUnits[0]

  if (
    firstUnit &&
    typeof firstUnit === "object" &&
    "conversion_value" in firstUnit
  ) {
    return toNumber(firstUnit.conversion_value) ?? 1
  }

  return 1
}

export function toNumber(value: unknown) {
  if (value == null) {
    return null
  }

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

  const coerced = Number(value)
  return Number.isNaN(coerced) ? null : coerced
}

export function toIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}
