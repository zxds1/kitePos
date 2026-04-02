import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { INVENTORY_CONFIG_MODULE } from "../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../modules/inventory-config/service"
import { RESTOCK_MODULE } from "../../../modules/restock"
import type RestockModuleService from "../../../modules/restock/service"
import {
  CreateProductSchema,
  ListProductsSchema,
} from "./validator"
import {
  getIdempotencyKey,
  getNormalizedProductByCreateIdempotencyKey,
  listNormalizedProducts,
  resolveShopId,
} from "./_utils"
import { getDefaultShopLocation } from "../../pos/_utils/shop-locations"
import type {
  ProductQueryRecord,
  ProductVariantQueryRecord,
} from "./_utils"

type PosCreateBodyCarrier = MedusaRequest & {
  pos_product_body?: unknown
}

function normalizeCreateProductInput(input: unknown) {
  const posParsed = CreateProductSchema.safeParse(input)

  if (posParsed.success) {
    return posParsed
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return posParsed
  }

  const candidate = input as Record<string, unknown>
  const metadata =
    candidate.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata)
      ? (candidate.metadata as Record<string, unknown>)
      : {}
  const variants = Array.isArray(candidate.variants)
    ? (candidate.variants as Array<Record<string, unknown>>)
    : []
  const primaryVariant = variants[0] ?? {}
  const prices = Array.isArray(primaryVariant.prices)
    ? (primaryVariant.prices as Array<Record<string, unknown>>)
    : []
  const primaryPrice = prices[0] ?? {}
  const metadataSellingUnits = Array.isArray(metadata.pos_selling_units)
    ? metadata.pos_selling_units
    : null
  const normalizedFromAdmin = {
    name: candidate.title,
    category:
      typeof metadata.pos_category === "string" ? metadata.pos_category : undefined,
    inventory_type: metadata.pos_inventory_type,
    purchase_unit:
      typeof metadata.pos_purchase_unit === "string"
        ? metadata.pos_purchase_unit
        : "Unit",
    purchase_value: metadata.pos_purchase_value,
    cost_per_purchase: metadata.pos_cost_per_purchase,
    selling_units:
      metadataSellingUnits ??
      [
        {
          unit:
            typeof primaryVariant.title === "string" && primaryVariant.title.length
              ? primaryVariant.title
              : "piece",
          price: primaryPrice.amount,
          conversion_value: 1,
        },
      ],
    low_stock_threshold: metadata.pos_low_stock_threshold,
    is_active: metadata.pos_is_active,
    stock_remaining: metadata.pos_stock_remaining,
  }

  return CreateProductSchema.safeParse(normalizedFromAdmin)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const parsed = ListProductsSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: parsed.error.flatten(),
    })
    return
  }

  const query = parsed.data
  const shopId = resolveShopId(
    req as PosAuthenticatedRequest,
    query.shop_id
  )

  const products = await listNormalizedProducts(req, { shopId })
  const locationId = query.location_id?.trim() || null
  const locationScopedProducts = await listNormalizedProducts(req, {
    shopId,
    locationId,
  })
  const search = query.search?.trim().toLowerCase()

  const filtered = locationScopedProducts
    .filter((product) =>
      query.inventory_type ? product.inventory_type === query.inventory_type : true
    )
    .filter((product) => product.is_active === query.is_active)
    .filter((product) => {
      if (!search) {
        return true
      }

      return [
        product.name,
        product.category,
        product.purchase_unit,
        product.inventory_type,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(search))
    })

  const paginated = filtered.slice(query.offset, query.offset + query.limit)

  res.json({
    success: true,
    products: paginated,
    count: filtered.length,
    limit: query.limit,
    offset: query.offset,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const requestBody = (req as PosCreateBodyCarrier).pos_product_body ?? req.body
  const parsed = normalizeCreateProductInput(requestBody)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const body = parsed.data
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
  const storeModuleService = req.scope.resolve(Modules.STORE)
  const stockLocationService = req.scope.resolve(Modules.STOCK_LOCATION)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [store] = await storeModuleService.listStores()
  const [stockLocation] = await stockLocationService.listStockLocations(
    {},
    {
      take: 1,
    }
  )

  const primarySellingUnit = body.selling_units[0]
  const initialStock = body.stock_remaining ?? body.purchase_value
  const shopId = resolveShopId(req as PosAuthenticatedRequest)
  if (!shopId) {
    res.status(400).json({
      success: false,
      message: "shop_id is required for POS product operations",
    })
    return
  }
  const idempotencyKey = getIdempotencyKey(req)
  const location = await getDefaultShopLocation(
    req.scope,
    shopId,
    body.location_id?.trim() || null
  )

  if (idempotencyKey) {
    const existingProduct = await getNormalizedProductByCreateIdempotencyKey(
      req,
      idempotencyKey,
      shopId
    )

    if (existingProduct) {
      res.status(200).json({
        success: true,
        product: existingProduct,
      })
      return
    }
  }

  const { result } = await createProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          title: body.name,
          status: ProductStatus.PUBLISHED,
          discountable: false,
          metadata: {
            pos_category: body.category ?? null,
            pos_cost_per_purchase: body.cost_per_purchase ?? null,
            pos_create_idempotency_key: idempotencyKey,
            pos_shop_id: shopId ?? null,
            pos_default_location_id: location?.id ?? null,
          },
          options: [
            {
              title: "Unit",
              values: [primarySellingUnit.unit],
            },
          ],
          variants: [
            {
              title: "Default Variant",
              manage_inventory: true,
              options: {
                Unit: primarySellingUnit.unit,
              },
              prices: [
                {
                  amount: primarySellingUnit.price,
                  currency_code: "kes",
                },
              ],
            },
          ],
          sales_channels: store?.default_sales_channel_id
            ? [{ id: store.default_sales_channel_id }]
            : undefined,
        },
      ],
    },
  })

  const productId = result[0]?.id

  const { data: createdProducts } = await query.graph({
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
      "variants.created_at",
      "variants.updated_at",
      "variants.inventory.id",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
    ],
    filters: {
      id: productId,
    },
  })

  const createdProduct = (createdProducts as ProductQueryRecord[])[0]
  const createdVariant = createdProduct?.variants?.find(
    (variant): variant is ProductVariantQueryRecord => Boolean(variant?.id)
  )
  const inventoryItemId = createdVariant?.inventory
    ?.find((inventoryItem) => Boolean(inventoryItem?.id))
    ?.id

  if (!createdProduct || !createdVariant) {
    throw new Error("Created product could not be resolved")
  }

  if (inventoryItemId && stockLocation?.id && initialStock > 0) {
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: inventoryItemId,
            location_id: stockLocation.id,
            stocked_quantity: initialStock,
          },
        ],
      },
    })
  }

  await inventoryConfigService.createInventoryConfigs({
    shop_id: shopId,
    variant_id: createdVariant.id,
    inventory_type: body.inventory_type,
    purchase_unit: body.purchase_unit,
    purchase_value: body.purchase_value,
    selling_units: body.selling_units,
    low_stock_threshold: body.low_stock_threshold,
    is_active: body.is_active,
  } as unknown as Record<string, unknown>)

  if (initialStock > 0) {
    const totalCost = body.cost_per_purchase ?? 0
    await restockService.createRestocks({
      shop_id: shopId,
      location_id: location?.id ?? null,
      variant_id: createdVariant.id,
      quantity_received: initialStock,
      purchase_unit_qty: body.purchase_value,
      cost_per_unit: body.purchase_value > 0 ? totalCost / body.purchase_value : 0,
      total_cost: totalCost,
      idempotency_key: idempotencyKey,
      source: "manual",
      supplier_name: "Initial stock",
      sales_channel: "pos",
      conversion_snapshot: {
        inventory_type: body.inventory_type,
        purchase_unit: body.purchase_unit,
        purchase_value: body.purchase_value,
        selling_units: body.selling_units,
      },
      timestamp: new Date(),
    } as unknown as Record<string, unknown>)
  }

  const normalizedProduct = {
    id: createdProduct.id,
    variant_id: createdVariant.id,
    location_id: location?.id ?? null,
    name: body.name,
    category: body.category ?? null,
    cost_per_purchase: body.cost_per_purchase ?? null,
    inventory_type: body.inventory_type,
    purchase_unit: body.purchase_unit,
    purchase_value: body.purchase_value,
    selling_units: body.selling_units,
    conversion_factor: body.selling_units[0]?.conversion_value ?? 1,
    stock_remaining: initialStock,
    low_stock_threshold: body.low_stock_threshold,
    is_active: body.is_active,
    image_url: createdVariant.thumbnail ?? createdProduct.thumbnail ?? null,
    last_synced_at: new Date().toISOString(),
    created_at: createdVariant.created_at
      ? new Date(createdVariant.created_at).toISOString()
      : createdProduct.created_at
        ? new Date(createdProduct.created_at).toISOString()
        : null,
    updated_at: createdVariant.updated_at
      ? new Date(createdVariant.updated_at).toISOString()
      : createdProduct.updated_at
        ? new Date(createdProduct.updated_at).toISOString()
        : null,
  }

  res.status(201).json({
    success: true,
    product: normalizedProduct,
  })
}
