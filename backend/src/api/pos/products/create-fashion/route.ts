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
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import { INVENTORY_CONFIG_MODULE } from "../../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../../modules/inventory-config/service"
import { getDefaultShopLocation } from "../../_utils/shop-locations"

const CreateFashionSchema = z.object({
  name: z.string().min(1),
  brand: z.string().trim().optional(),
  category: z.string().min(1),
  sizes: z.array(z.string().min(1)).min(1),
  colors: z.array(z.string().min(1)).min(1),
  base_price: z.number().positive(),
  stock_per_variant: z.number().min(0).default(5),
  material: z.string().trim().optional(),
  gender: z.enum(["men", "women", "unisex", "boys", "girls"]).optional(),
  location_id: z.string().optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = CreateFashionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid product data",
      errors: parsed.error.flatten(),
    })
    return
  }

  const body = parsed.data
  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
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
  const location = await getDefaultShopLocation(
    req.scope,
    auth.shop_id,
    body.location_id?.trim() || null
  )

  const createdVariants: Array<Record<string, unknown>> = []

  for (const size of body.sizes) {
    for (const color of body.colors) {
      const { result } = await createProductsWorkflow(req.scope).run({
        input: {
          products: [
            {
              title: `${body.name} ${size} ${color}`.trim(),
              status: ProductStatus.PUBLISHED,
              discountable: false,
              metadata: {
                pos_category: body.category,
                pos_shop_id: auth.shop_id,
                pos_default_location_id: location?.id ?? null,
                pos_brand: body.brand ?? null,
              },
              options: [
                {
                  title: "Unit",
                  values: ["Piece"],
                },
              ],
              variants: [
                {
                  title: "Default Variant",
                  manage_inventory: true,
                  options: {
                    Unit: "Piece",
                  },
                  prices: [
                    {
                      amount: body.base_price,
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
          "variants.id",
          "variants.inventory.id",
        ],
        filters: {
          id: productId,
        },
      })

      const createdProduct = (createdProducts as Array<Record<string, unknown>>)[0]
      const createdVariant = Array.isArray(createdProduct?.variants)
        ? (createdProduct.variants[0] as Record<string, unknown> | undefined)
        : undefined
      const createdVariantId =
        typeof createdVariant?.id === "string" ? createdVariant.id : null
      const inventoryItems = Array.isArray(createdVariant?.inventory)
        ? (createdVariant.inventory as Array<Record<string, unknown>>)
        : []
      const inventoryItemId =
        typeof inventoryItems[0]?.["id"] === "string"
          ? (inventoryItems[0]?.["id"] as string)
          : null

      if (!createdVariantId) {
        continue
      }

      await inventoryConfigService.createInventoryConfigs({
        shop_id: auth.shop_id,
        variant_id: createdVariantId,
        inventory_type: "discrete",
        purchase_unit: "Piece",
        purchase_value: 1,
        selling_units: [
          { unit: "Piece", price: body.base_price, conversion_value: 1 },
        ],
        low_stock_threshold: 2,
        brand: body.brand ?? null,
        size,
        color,
        material: body.material ?? null,
        gender: body.gender ?? null,
        is_active: true,
      } as unknown as Record<string, unknown>)

      if (inventoryItemId && stockLocation?.id && body.stock_per_variant > 0) {
        await createInventoryLevelsWorkflow(req.scope).run({
          input: {
            inventory_levels: [
              {
                inventory_item_id: inventoryItemId,
                location_id: stockLocation.id,
                stocked_quantity: body.stock_per_variant,
              },
            ],
          },
        })
      }

      createdVariants.push({
        variant_id: createdVariantId,
        size,
        color,
        stock: body.stock_per_variant,
        price: body.base_price,
      })
    }
  }

  res.status(201).json({
    success: true,
    product: {
      name: body.name,
      brand: body.brand ?? null,
      category: body.category,
      variants_count: createdVariants.length,
    },
    variants: createdVariants,
    message: `Created ${createdVariants.length} variants`,
  })
}
