import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../auth/_utils/jwt"
import { getAuthorizedShop, shapePrivacyConsent } from "../settings/_utils"

const ConsentSchema = z.object({
  data_collection: z.boolean(),
  data_sharing: z.boolean(),
  analytics: z.boolean(),
  consent_date: z.coerce.date().optional(),
  consent_version: z.string().min(1).max(20),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth || !auth.shop_id) {
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shop = await getAuthorizedShop(shopService, auth.shop_id)

  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  res.status(200).json({
    success: true,
    consent: shapePrivacyConsent(shop),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth || !auth.shop_id) {
    return
  }

  const validated = ConsentSchema.safeParse(req.body)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validated.error.flatten(),
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [updatedShop] = await shopService.updateShops([
    {
      id: auth.shop_id,
      consent_given: validated.data.data_collection,
      data_sharing_consent: validated.data.data_sharing,
      analytics_consent: validated.data.analytics,
      consent_timestamp: validated.data.consent_date ?? new Date(),
      consent_version: validated.data.consent_version,
    },
  ])

  res.status(200).json({
    success: true,
    consent: shapePrivacyConsent(updatedShop as unknown as Record<string, unknown>),
  })
}
