import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { normalizeKenyanPhone } from "../../../../utils/hash"
import { LoyaltyService } from "../../../../services/loyalty.service"

const MemberSchema = z.object({
  full_name: z.string().trim().min(1),
  phone_number: z.string().trim().min(7),
  tier: z.enum(["silver", "gold", "platinum", "bronze"]).default("silver"),
  date_of_birth: z.string().trim().optional().nullable(),
  referred_by_phone: z.string().trim().optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({ success: false, message: "Only owner or admin can enrol members" })
    return
  }

  const parsed = MemberSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid loyalty member payload", errors: parsed.error.flatten() })
    return
  }

  const loyalty = new LoyaltyService(req.scope)
  let normalizedPhone: string
  try {
    normalizedPhone = normalizeKenyanPhone(parsed.data.phone_number)
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Invalid phone number",
    })
    return
  }

  const result = await loyalty.enrollMember({
    shopId: auth.shop_id,
    fullName: parsed.data.full_name,
    phoneNumber: normalizedPhone,
    tier: parsed.data.tier,
    dateOfBirth: parsed.data.date_of_birth ?? null,
    referredByPhone: parsed.data.referred_by_phone ?? null,
    createdBy: auth.user_id ?? null,
  })

  res.status(result.created ? 201 : 200).json({
    success: true,
    message: result.created ? "Member enrolled" : "Member already enrolled",
    program: loyalty.shapeProgram(result.program),
    member: loyalty.shapeMember(result.member, result.program),
  })
}
