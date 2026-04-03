import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { LOYALTY_LEDGER_MODULE } from "../../../../modules/loyalty-ledger"
import type LoyaltyLedgerModuleService from "../../../../modules/loyalty-ledger/service"
import { LOYALTY_MEMBER_MODULE } from "../../../../modules/loyalty-member"
import type LoyaltyMemberModuleService from "../../../../modules/loyalty-member/service"
import { LoyaltyService } from "../../../../services/loyalty.service"

const LedgerSchema = z.object({
  member_id: z.string().min(1),
  entry_type: z.enum(["earn", "redeem", "adjust", "promotional", "birthday_bonus"]),
  points_delta: z.coerce.number().int(),
  reward_name: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = LedgerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid loyalty ledger payload", errors: parsed.error.flatten() })
    return
  }

  const memberService: LoyaltyMemberModuleService = req.scope.resolve(LOYALTY_MEMBER_MODULE)
  const ledgerService: LoyaltyLedgerModuleService = req.scope.resolve(LOYALTY_LEDGER_MODULE)
  const loyalty = new LoyaltyService(req.scope)
  const [members] = await memberService.listAndCountLoyaltyMembers(
    { id: parsed.data.member_id, shop_id: auth.shop_id },
    { take: 1 }
  )
  const member = members[0] as Record<string, unknown> | undefined
  if (!member) {
    res.status(404).json({ success: false, message: "Loyalty member not found" })
    return
  }

  const currentBalance = Number(member.points_balance ?? 0)
  const proposedBalance = currentBalance + parsed.data.points_delta
  if (proposedBalance < 0) {
    res.status(400).json({ success: false, message: "Points balance cannot go below zero" })
    return
  }

  const created = await ledgerService.createLoyaltyLedgers({
    id: `led_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    member_id: parsed.data.member_id,
    entry_type: parsed.data.entry_type,
    points_delta: parsed.data.points_delta,
    points_balance_after: proposedBalance,
    reward_name: parsed.data.reward_name ?? null,
    notes: parsed.data.notes ?? null,
    created_by: auth.user_id ?? null,
    timestamp: new Date(),
  } as Record<string, unknown>)

  const totalEarned =
    Number(member.total_points_earned ?? 0) +
    (parsed.data.points_delta > 0 ? parsed.data.points_delta : 0)
  const totalRedeemed =
    Number(member.total_points_redeemed ?? 0) +
    (parsed.data.points_delta < 0 ? Math.abs(parsed.data.points_delta) : 0)

  const program = await loyalty.getOrCreateProgram(auth.shop_id)
  await loyalty.updateTierStatus(member, program, {
    points_balance: proposedBalance,
    total_points_earned: totalEarned,
    total_points_redeemed: totalRedeemed,
    last_activity_at: new Date(),
  })

  const createdEntry = created as Record<string, unknown>

  res.status(201).json({
    success: true,
    ledger_entry: {
      id: createdEntry.id,
      member_id: createdEntry.member_id,
      entry_type: createdEntry.entry_type,
      points_delta: Number(createdEntry.points_delta ?? 0),
      points_balance_after: Number(createdEntry.points_balance_after ?? proposedBalance),
      reward_name: createdEntry.reward_name ?? null,
      notes: createdEntry.notes ?? null,
      timestamp: createdEntry.timestamp ?? null,
    },
  })
}
