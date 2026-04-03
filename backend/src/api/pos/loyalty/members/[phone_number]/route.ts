import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { LOYALTY_LEDGER_MODULE } from "../../../../../modules/loyalty-ledger"
import type LoyaltyLedgerModuleService from "../../../../../modules/loyalty-ledger/service"
import { LoyaltyService } from "../../../../../services/loyalty.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const loyalty = new LoyaltyService(req.scope)
  const member = await loyalty.findMember(auth.shop_id, req.params.phone_number)
  if (!member) {
    res.status(404).json({ success: false, message: "Customer not enrolled" })
    return
  }

  const program = await loyalty.getOrCreateProgram(auth.shop_id)
  const ledgerService: LoyaltyLedgerModuleService = req.scope.resolve(LOYALTY_LEDGER_MODULE)
  const [ledger] = await ledgerService.listAndCountLoyaltyLedgers(
    { member_id: String(member.id), shop_id: auth.shop_id },
    { take: 30, order: { timestamp: "DESC" } }
  )
  const rewards = await loyalty.listRewards(auth.shop_id, String(member.id))

  res.status(200).json({
    success: true,
    program: loyalty.shapeProgram(program),
    member: loyalty.shapeMember(member, program),
    rewards,
    recent_ledger: (ledger as Array<Record<string, unknown>>).map((entry) => ({
      id: entry.id,
      entry_type: entry.entry_type,
      points_delta: Number(entry.points_delta ?? 0),
      points_balance_after: Number(entry.points_balance_after ?? 0),
      reward_name: entry.reward_name ?? null,
      notes: entry.notes ?? null,
      timestamp: entry.timestamp ?? null,
    })),
  })
}
