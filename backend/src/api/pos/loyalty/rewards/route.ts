import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { LOYALTY_REWARD_MODULE } from "../../../../modules/loyalty-reward"
import type LoyaltyRewardModuleService from "../../../../modules/loyalty-reward/service"
import { LoyaltyService } from "../../../../services/loyalty.service"

const RewardSchema = z.object({
  reward_name: z.string().trim().min(1),
  reward_type: z.enum(["discount", "free_item", "store_credit", "mpesa_cashback", "voucher"]),
  points_cost: z.coerce.number().int().min(1),
  cash_value: z.coerce.number().min(0).default(0),
  reward_variant_id: z.string().trim().optional().nullable(),
  reward_quantity: z.coerce.number().int().min(1).optional().default(1),
  discount_type: z.enum(["percent", "fixed", "free_shipping"]).optional().nullable(),
  discount_value: z.coerce.number().min(0).optional().nullable(),
  min_purchase_amount: z.coerce.number().min(0).optional().nullable(),
  max_redemptions_per_customer: z.coerce.number().int().min(1).optional().nullable(),
  max_redemptions_total: z.coerce.number().int().min(1).optional().nullable(),
  valid_from: z.coerce.date().optional().nullable(),
  valid_until: z.coerce.date().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  terms_and_conditions: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional().default(true),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const memberId =
    typeof req.query.member_id === "string" && req.query.member_id.trim().length
      ? req.query.member_id.trim()
      : null
  const loyalty = new LoyaltyService(req.scope)
  const rewards = await loyalty.listRewards(auth.shop_id, memberId)
  res.status(200).json({ success: true, rewards })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }
  if (!canManageBranches(auth.role)) {
    res.status(403).json({ success: false, message: "Only owner or admin can manage loyalty rewards" })
    return
  }

  const parsed = RewardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid reward payload", errors: parsed.error.flatten() })
    return
  }

  const service: LoyaltyRewardModuleService = req.scope.resolve(LOYALTY_REWARD_MODULE)
  const loyalty = new LoyaltyService(req.scope)
  const created = await service.createLoyaltyRewards({
    id: `lrw_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    ...parsed.data,
  } as Record<string, unknown>)

  res.status(201).json({
    success: true,
    reward: loyalty.shapeReward(created as Record<string, unknown>),
  })
}
