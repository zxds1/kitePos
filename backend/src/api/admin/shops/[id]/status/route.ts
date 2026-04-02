import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"

const UpdateShopStatusSchema = z.object({
  is_active: z.boolean(),
})

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const { id } = req.params
  const validated = UpdateShopStatusSchema.safeParse(req.body)

  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const [shop] = await shopService.listShops({ id }, { take: 1 })

  if (!shop) {
    res.status(404).json({
      success: false,
      message: "Shop not found",
    })
    return
  }

  const [updatedShop] = await shopService.updateShops([
    {
      id,
      is_active: validated.data.is_active,
    },
  ])

  res.status(200).json({
    success: true,
    shop: {
      id: updatedShop.id,
      shop_name: updatedShop.shop_name,
      is_active: updatedShop.is_active,
      updated_at: updatedShop.updated_at,
    },
  })
}
