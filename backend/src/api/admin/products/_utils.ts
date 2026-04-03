import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import type { MedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { INVENTORY_CONFIG_MODULE } from "../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../modules/inventory-config/service"
import { calculateServerStock } from "../inventory/_utils/stock"

export type ProductQueryRecord = {
  id: string
  title?: string | null
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
  deleted_at?: string | Date | null
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
  shop_id?: string | null
  variant_id: string
  inventory_type?: string | null
  purchase_unit?: string | null
  purchase_value?: number | { value?: string } | null
  selling_units?: unknown
  low_stock_threshold?: number | { value?: string } | null
  brand?: string | null
  style_code?: string | null
  size?: string | null
  color?: string | null
  gender?: string | null
  material?: string | null
  imei?: string | null
  serial_number?: string | null
  model_name?: string | null
  storage_capacity?: string | null
  device_condition?: string | null
  warranty_enabled?: boolean | null
  warranty_months?: number | { value?: string } | null
  is_returnable?: boolean | null
  return_window_days?: number | { value?: string } | null
  is_active?: boolean | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
}

export type NormalizedPosProduct = {
  id: string
  variant_id: string
  location_id: string | null
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
  brand: string | null
  style_code: string | null
  size: string | null
  color: string | null
  gender: string | null
  material: string | null
  imei: string | null
  serial_number: string | null
  model_name: string | null
  storage_capacity: string | null
  device_condition: string | null
  warranty_enabled: boolean
  warranty_months: number | null
  is_returnable: boolean
  return_window_days: number | null
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
    locationId?: string | null
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
        "deleted_at",
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
    if (
      options.shopId &&
      config.shop_id != null &&
      config.shop_id !== options.shopId
    ) {
      continue
    }

    if (!inventoryConfigByVariant.has(config.variant_id)) {
      inventoryConfigByVariant.set(config.variant_id, config)
    }
  }

  const products = await Promise.all(
    (data as ProductQueryRecord[])
      .filter((product) => product.deleted_at == null)
      .flatMap((product) =>
      (product.variants ?? [])
        .filter(
          (variant): variant is ProductVariantQueryRecord =>
            Boolean(variant?.id) &&
            (!options.variantId || variant?.id === options.variantId)
        )
        .map(async (variant) => {
          const inventoryConfig = inventoryConfigByVariant.get(variant.id)
          if (!inventoryConfig) {
            return null
          }

          const stockRemaining = options.shopId
            ? await calculateServerStock(
                req.scope,
                options.shopId,
                variant.id,
                options.locationId
              )
            : getVariantInventoryStock(variant)

          return {
            id: product.id,
            variant_id: variant.id,
            location_id: options.locationId ?? null,
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
            brand: toText(
              inventoryConfig?.brand ?? product.metadata?.["pos_brand"]
            ),
            style_code: toText(
              inventoryConfig?.style_code ?? product.metadata?.["pos_style_code"]
            ),
            size: toText(inventoryConfig?.size),
            color: toText(inventoryConfig?.color),
            gender: toText(inventoryConfig?.gender),
            material: toText(inventoryConfig?.material),
            imei: toText(inventoryConfig?.imei),
            serial_number: toText(inventoryConfig?.serial_number),
            model_name: toText(
              inventoryConfig?.model_name ?? product.metadata?.["pos_model_name"]
            ),
            storage_capacity: toText(inventoryConfig?.storage_capacity),
            device_condition: toText(inventoryConfig?.device_condition),
            warranty_enabled: inventoryConfig?.warranty_enabled === true,
            warranty_months: toNumber(inventoryConfig?.warranty_months),
            is_returnable: inventoryConfig?.is_returnable !== false,
            return_window_days: toNumber(
              inventoryConfig?.return_window_days
            ),
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

  return products.filter((product): product is NormalizedPosProduct => product != null)
}

export async function getNormalizedProductByVariantId(
  req: MedusaRequest,
  variantId: string,
  shopId?: string | null
) {
  const products = await listNormalizedProducts(req, { shopId, variantId })
  return products[0] ?? null
}

export async function getNormalizedProductByCreateIdempotencyKey(
  req: MedusaRequest,
  idempotencyKey: string,
  shopId?: string | null
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["variants.id", "metadata", "deleted_at"],
  })

  for (const product of data as ProductQueryRecord[]) {
    if (product.deleted_at != null) {
      continue
    }

    if (product.metadata?.["pos_create_idempotency_key"] !== idempotencyKey) {
      continue
    }

    if (
      shopId &&
      product.metadata?.["pos_shop_id"] != null &&
      product.metadata?.["pos_shop_id"] !== shopId
    ) {
      continue
    }

    const variantId = product.variants?.find((variant) => Boolean(variant?.id))?.id
    if (!variantId) {
      continue
    }

    return getNormalizedProductByVariantId(req, variantId, shopId)
  }

  return null
}

export async function getInventoryConfigByVariantId(
  req: MedusaRequest,
  variantId: string,
  shopId?: string | null
) {
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const [config] = await inventoryConfigService.listInventoryConfigs(
    {
      variant_id: variantId,
      ...(shopId ? { shop_id: shopId } : {}),
    },
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
      "deleted_at",
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
    if (product.deleted_at != null) {
      continue
    }

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

export function getIdempotencyKey(req: MedusaRequest) {
  const rawHeader =
    req.headers["idempotency-key"] ?? req.headers["Idempotency-Key"]

  if (Array.isArray(rawHeader)) {
    const value = rawHeader.find(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    )

    return value?.trim() ?? null
  }

  return typeof rawHeader === "string" && rawHeader.trim().length > 0
    ? rawHeader.trim()
    : null
}

type ContainerLike = MedusaRequest | MedusaContainer | { scope: MedusaContainer }

function resolveContainer(target: ContainerLike) {
  if ("scope" in target && target.scope) {
    return target.scope
  }

  return target as MedusaContainer
}

export async function getPrimaryStockLevelContext(
  target: ContainerLike,
  variantId: string
) {
  const container = resolveContainer(target)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
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

export async function syncAggregateInventoryLevelForVariant(
  target: ContainerLike,
  shopId: string,
  variantId: string
) {
  const container = resolveContainer(target)
  const stockLevel = await getPrimaryStockLevelContext(container, variantId)
  if (
    !stockLevel.inventory_level_id ||
    !stockLevel.inventory_item_id ||
    !stockLevel.location_id
  ) {
    return
  }

  const aggregateStock = await calculateServerStock(container, shopId, variantId)
  await updateInventoryLevelsWorkflow(container).run({
    input: {
      updates: [
        {
          id: stockLevel.inventory_level_id,
          inventory_item_id: stockLevel.inventory_item_id,
          location_id: stockLevel.location_id,
          stocked_quantity: aggregateStock,
        },
      ],
    },
  })
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

export function toText(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
