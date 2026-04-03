import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { getAuthorizedShop } from "../../../settings/_utils"

const PolicySchema = z.object({
  accepts_returns: z.boolean().default(true),
  return_window_days: z.coerce.number().int().min(1).default(7),
  conditions: z.array(z.string()).default([]),
  restocking_fee_percent: z.coerce.number().min(0).default(0),
  refund_methods: z.array(z.string()).default(["store_credit", "original_payment"]),
  excludes_categories: z.array(z.string()).default([]),
})

const UpdateReturnPoliciesSchema = z.object({
  return_policy: PolicySchema.optional(),
  b2b_return_policy: PolicySchema.optional(),
  online_return_policy: PolicySchema.optional(),
})

function shapePolicies(shop: Record<string, unknown>) {
  return {
    return_policy: shop.return_policy ?? null,
    b2b_return_policy: shop.b2b_return_policy ?? null,
    online_return_policy: shop.online_return_policy ?? null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const { id } = req.params
  if (auth.shop_id !== id) {
    res.status(403).json({
      success: false,
      message: "You can only access your own return policies",
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
    policies: shapePolicies(shop),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const { id } = req.params
  if (auth.shop_id !== id) {
    res.status(403).json({
      success: false,
      message: "You can only update your own return policies",
    })
    return
  }

  if (auth.role !== "owner") {
    res.status(403).json({
      success: false,
      message: "Only the shop owner can update return policies",
    })
    return
  }

  const parsed = UpdateReturnPoliciesSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid return policy payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const payload: Record<string, unknown> = { id }
  if (parsed.data.return_policy) {
    payload.return_policy = parsed.data.return_policy
  }
  if (parsed.data.b2b_return_policy) {
    payload.b2b_return_policy = parsed.data.b2b_return_policy
  }
  if (parsed.data.online_return_policy) {
    payload.online_return_policy = parsed.data.online_return_policy
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [updatedShop] = await shopService.updateShops([payload])

  res.status(200).json({
    success: true,
    policies: shapePolicies(updatedShop as Record<string, unknown>),
  })
}
