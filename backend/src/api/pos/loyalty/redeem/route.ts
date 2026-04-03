import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { LoyaltyService } from "../../../../services/loyalty.service"

const RedeemSchema = z.object({
  phone_number: z.string().trim().min(7),
  reward_id: z.string().trim().min(1),
  sale_id: z.string().trim().optional().nullable(),
  mpesa_phone: z.string().trim().optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = RedeemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid redemption payload", errors: parsed.error.flatten() })
    return
  }

  try {
    const loyalty = new LoyaltyService(req.scope)
    const result = await loyalty.redeemReward({
      shopId: auth.shop_id,
      phoneNumber: parsed.data.phone_number,
      rewardId: parsed.data.reward_id,
      saleId: parsed.data.sale_id ?? null,
      mpesaPhone: parsed.data.mpesa_phone ?? null,
      createdBy: auth.user_id ?? null,
    })

    res.status(200).json({
      success: true,
      redemption: {
        id: result.redemption.id,
        reward_name: result.reward.reward_name,
        reward_type: result.reward.reward_type,
        points_redeemed: result.redemption.points_redeemed,
        value_received: result.redemption.value_received,
        status: result.redemption.status,
        mpesa_phone: result.redemption.mpesa_phone ?? null,
        voucher_code: result.redemption.voucher_code ?? null,
      },
      points_balance: result.nextBalance,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to redeem reward",
    })
  }
}
