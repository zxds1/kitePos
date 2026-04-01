import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"

const UpdatePaymentSettingsSchema = z.object({
  mpesa_phone: z
    .string()
    .regex(/^254[0-9]{9}$/, "Must be in format 2547XXXXXXXX")
    .optional(),
  mpesa_till: z.string().optional(),
  mpesa_paybill: z.string().optional(),
  accept_mpesa: z.boolean().optional(),
  mpesa_display_name: z.string().max(50).optional(),
})

async function getShopOrNull(
  shopService: ShopModuleService,
  id: string
) {
  const [shop] = await shopService.listShops(
    { id },
    {
      take: 1,
    }
  )

  return shop ?? null
}

function shapePaymentSettings(shop: Record<string, unknown>) {
  return {
    id: shop.id,
    shop_name: shop.shop_name,
    mpesa_phone: shop.mpesa_phone,
    mpesa_till: shop.mpesa_till,
    mpesa_paybill: shop.mpesa_paybill,
    accept_mpesa: shop.accept_mpesa,
    mpesa_display_name: shop.mpesa_display_name,
  }
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const { id } = req.params
  const validated = UpdatePaymentSettingsSchema.safeParse(req.body)

  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const shop = await getShopOrNull(shopService, id)

  if (!shop) {
    res.status(404).json({
      success: false,
      message: "Shop not found",
    })
    return
  }

  const [updatedShop] = await shopService.updateShops([
    {
      id: shop.id,
      ...validated.data,
    },
  ])

  res.status(200).json({
    success: true,
    shop: shapePaymentSettings(updatedShop as unknown as Record<string, unknown>),
  })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const { id } = req.params

  const shop = await getShopOrNull(shopService, id)

  if (!shop) {
    res.status(404).json({
      success: false,
      message: "Shop not found",
    })
    return
  }

  res.status(200).json({
    success: true,
    shop: shapePaymentSettings(shop as unknown as Record<string, unknown>),
  })
}
