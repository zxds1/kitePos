import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVENTORY_CONFIG_MODULE } from "../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../modules/inventory-config/service"
import { calculateServerStock } from "../inventory/_utils/stock"

type ProductQueryRecord = {
  id: string
  title?: string | null
  thumbnail?: string | null
  categories?: Array<{ name?: string | null } | null> | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
  variants?: Array<ProductVariantQueryRecord | null> | null
}

type ProductVariantQueryRecord = {
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
    location_levels?: Array<{
      stocked_quantity?: number | null
    } | null> | null
  } | null> | null
}

type InventoryConfigRecord = {
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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
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

  const shopId =
    typeof req.query.shop_id === "string" && req.query.shop_id.trim().length > 0
      ? req.query.shop_id.trim()
      : null

  const products = await Promise.all(
    (data as ProductQueryRecord[]).flatMap((product) =>
      (product.variants ?? [])
        .filter((variant): variant is ProductVariantQueryRecord => Boolean(variant?.id))
        .map(async (variant) => {
          const inventoryConfig = inventoryConfigByVariant.get(variant.id)
          const stockRemaining = shopId
            ? await calculateServerStock(req.scope, shopId, variant.id)
            : getVariantInventoryStock(variant)

          return {
            id: product.id,
            variant_id: variant.id,
            name: buildProductName(product, variant),
            category: getFirstCategoryName(product),
            inventory_type: inventoryConfig?.inventory_type ?? "discrete",
            purchase_unit: inventoryConfig?.purchase_unit ?? null,
            purchase_value: toNumber(inventoryConfig?.purchase_value),
            selling_units: normalizeSellingUnits(
              inventoryConfig?.selling_units,
              variant
            ),
            conversion_factor: getConversionFactor(inventoryConfig?.selling_units),
            stock_remaining: stockRemaining,
            low_stock_threshold: toNumber(inventoryConfig?.low_stock_threshold),
            is_active: inventoryConfig?.is_active ?? true,
            image_url: variant.thumbnail ?? product.thumbnail ?? null,
            last_synced_at: new Date().toISOString(),
            created_at: toIsoString(
              inventoryConfig?.created_at ?? variant.created_at ?? product.created_at
            ),
            updated_at: toIsoString(
              inventoryConfig?.updated_at ?? variant.updated_at ?? product.updated_at
            ),
          }
        })
    )
  )

  res.json({
    products,
    count: products.length,
  })
}

function buildProductName(
  product: ProductQueryRecord,
  variant: ProductVariantQueryRecord
) {
  const productTitle = product.title?.trim() || "Unnamed Product"
  const variantTitle = variant.title?.trim()

  if (!variantTitle || variantTitle === "Default Variant") {
    return productTitle
  }

  if (variantTitle.toLowerCase() == productTitle.toLowerCase()) {
    return productTitle
  }

  return `${productTitle} ${variantTitle}`.trim()
}

function getFirstCategoryName(product: ProductQueryRecord) {
  for (const category of product.categories ?? []) {
    if (category?.name) {
      return category.name
    }
  }

  return null
}

function getVariantInventoryStock(variant: ProductVariantQueryRecord) {
  return (variant.inventory ?? []).reduce((inventorySum, inventoryItem) => {
    const locationLevelTotal = (inventoryItem?.location_levels ?? []).reduce(
      (levelSum, level) => levelSum + Number(level?.stocked_quantity ?? 0),
      0
    )

    return inventorySum + locationLevelTotal
  }, 0)
}

function normalizeSellingUnits(
  rawSellingUnits: unknown,
  variant: ProductVariantQueryRecord
) {
  if (Array.isArray(rawSellingUnits) && rawSellingUnits.length > 0) {
    return rawSellingUnits
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

function getConversionFactor(rawSellingUnits: unknown) {
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

function toNumber(value: unknown) {
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

function toIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return new Date(value).toISOString()
}
