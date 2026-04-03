import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { LOYALTY_PROGRAM_MODULE } from "../../../../modules/loyalty-program"
import type LoyaltyProgramModuleService from "../../../../modules/loyalty-program/service"
import { LoyaltyService } from "../../../../services/loyalty.service"

const TierSchema = z.object({
  name: z.string().trim().min(1),
  label: z.string().trim().optional(),
  min_points: z.coerce.number().min(0).default(0),
  multiplier: z.coerce.number().min(1).default(1),
  benefits: z.array(z.string()).optional().default([]),
})

const ProgramSchema = z.object({
  program_name: z.string().trim().min(1).optional(),
  program_type: z.enum(["points", "tier", "cashback", "stamp", "hybrid"]).optional(),
  earn_rate: z.coerce.number().min(0).optional(),
  earn_rate_multiplier_weekend: z.coerce.number().min(1).optional(),
  earn_rate_multiplier_special: z.coerce.number().min(1).optional(),
  points_value: z.coerce.number().min(0).optional(),
  min_redemption_points: z.coerce.number().min(0).optional(),
  max_discount_percent: z.coerce.number().min(0).max(100).optional(),
  points_expire: z.boolean().optional(),
  expiry_days: z.coerce.number().min(1).optional(),
  has_tiers: z.boolean().optional(),
  tiers: z.array(TierSchema).optional(),
  stamp_target: z.coerce.number().min(1).optional(),
  stamp_reward: z.string().trim().optional().nullable(),
  cashback_percent: z.coerce.number().min(0).optional(),
  cashback_method: z.enum(["store_credit", "mpesa"]).optional(),
  cashback_min_purchase: z.coerce.number().min(0).optional(),
  referral_bonus_points: z.coerce.number().min(0).optional(),
  referral_signup_bonus: z.coerce.number().min(0).optional(),
  auto_enroll: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const loyalty = new LoyaltyService(req.scope)
  const program = await loyalty.getOrCreateProgram(auth.shop_id)
  res.status(200).json({
    success: true,
    program: loyalty.shapeProgram(program),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }
  if (!canManageBranches(auth.role)) {
    res.status(403).json({ success: false, message: "Only owner or admin can update loyalty program settings" })
    return
  }

  const parsed = ProgramSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid loyalty program payload", errors: parsed.error.flatten() })
    return
  }

  const loyalty = new LoyaltyService(req.scope)
  const service: LoyaltyProgramModuleService = req.scope.resolve(LOYALTY_PROGRAM_MODULE)
  const current = await loyalty.getOrCreateProgram(auth.shop_id)
  const payload = {
    shop_id: auth.shop_id,
    ...parsed.data,
  } as Record<string, unknown>

  const updated = current.id
    ? await service.updateLoyaltyPrograms({
        selector: { id: current.id },
        data: payload,
      })
    : await service.createLoyaltyPrograms({
        id: `lpr_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        ...payload,
      })
  void updated
  const refreshed = await loyalty.getOrCreateProgram(auth.shop_id)

  res.status(200).json({
    success: true,
    program: loyalty.shapeProgram(refreshed),
  })
}
