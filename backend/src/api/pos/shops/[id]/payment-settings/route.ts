import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { normalizeKenyanPhone } from "../../../../../utils/hash"
import { getAuthorizedShop, shapePaymentSettings } from "../../../settings/_utils"

const UpdatePaymentSettingsSchema = z.object({
  mpesa_phone: z.string().optional(),
  mpesa_till: z.string().max(20).optional().nullable(),
  mpesa_paybill: z.string().max(20).optional().nullable(),
  accept_mpesa: z.boolean().optional(),
  mpesa_display_name: z.string().max(50).optional().nullable(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const { id } = req.params
  if (auth.shop_id !== id) {
    res.status(403).json({
      success: false,
      message: "You can only access your own payment settings",
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shop = await getAuthorizedShop(shopService, id)

  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  res.status(200).json({
    success: true,
    payment_settings: shapePaymentSettings(shop),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const { id } = req.params
  if (auth.shop_id !== id) {
    res.status(403).json({
      success: false,
      message: "You can only update your own payment settings",
    })
    return
  }

  const validated = UpdatePaymentSettingsSchema.safeParse(req.body)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const payload: Record<string, unknown> = { id }

  if (validated.data.mpesa_phone != null) {
    payload.mpesa_phone = normalizeKenyanPhone(validated.data.mpesa_phone)
  }
  if (validated.data.mpesa_till !== undefined) {
    payload.mpesa_till = validated.data.mpesa_till
  }
  if (validated.data.mpesa_paybill !== undefined) {
    payload.mpesa_paybill = validated.data.mpesa_paybill
  }
  if (validated.data.accept_mpesa !== undefined) {
    payload.accept_mpesa = validated.data.accept_mpesa
  }
  if (validated.data.mpesa_display_name !== undefined) {
    payload.mpesa_display_name = validated.data.mpesa_display_name
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [updatedShop] = await shopService.updateShops([payload])

  res.status(200).json({
    success: true,
    payment_settings: shapePaymentSettings(
      updatedShop as unknown as Record<string, unknown>
    ),
  })
}
