import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { LOYALTY_MEMBER_MODULE } from "../../../modules/loyalty-member"
import type LoyaltyMemberModuleService from "../../../modules/loyalty-member/service"
import { LOYALTY_LEDGER_MODULE } from "../../../modules/loyalty-ledger"
import type LoyaltyLedgerModuleService from "../../../modules/loyalty-ledger/service"
import { LOYALTY_REDEMPTION_MODULE } from "../../../modules/loyalty-redemption"
import type LoyaltyRedemptionModuleService from "../../../modules/loyalty-redemption/service"
import { LoyaltyService } from "../../../services/loyalty.service"

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const memberService: LoyaltyMemberModuleService = req.scope.resolve(LOYALTY_MEMBER_MODULE)
  const ledgerService: LoyaltyLedgerModuleService = req.scope.resolve(LOYALTY_LEDGER_MODULE)
  const redemptionService: LoyaltyRedemptionModuleService = req.scope.resolve(
    LOYALTY_REDEMPTION_MODULE
  )
  const loyalty = new LoyaltyService(req.scope)
  const program = await loyalty.getOrCreateProgram(auth.shop_id)
  const [members, memberCount] = await memberService.listAndCountLoyaltyMembers(
    { shop_id: auth.shop_id, is_active: true },
    { take: 300, order: { created_at: "ASC" } }
  )
  const [ledger] = await ledgerService.listAndCountLoyaltyLedgers(
    { shop_id: auth.shop_id },
    { take: 40, order: { timestamp: "DESC" } }
  )
  const [redemptions] = await redemptionService.listAndCountLoyaltyRedemptions(
    { shop_id: auth.shop_id },
    { take: 20, order: { redeemed_at: "DESC" } }
  )

  const memberRecords = (members as Array<Record<string, unknown>>).map((member) =>
    loyalty.shapeMember(member, program)
  )
  const ledgerRecords = (ledger as Array<Record<string, unknown>>) ?? []
  const memberById = new Map(memberRecords.map((member) => [String(member.id), member]))
  const rewardList = await loyalty.listRewards(auth.shop_id)
  const tierCounts = memberRecords.reduce(
    (accumulator, member) => {
      const tier = String(member.current_tier ?? member.tier ?? "silver").toLowerCase()
      accumulator[tier] = (accumulator[tier] ?? 0) + 1
      return accumulator
    },
    { silver: 0, gold: 0, platinum: 0, bronze: 0 } as Record<string, number>
  )
  const totalPointsIssued = memberRecords.reduce(
    (sum, item) => sum + toNumber(item.total_points_earned),
    0
  )
  const totalPointsRedeemed = memberRecords.reduce(
    (sum, item) => sum + toNumber(item.total_points_redeemed),
    0
  )

  res.status(200).json({
    success: true,
    program: loyalty.shapeProgram(program),
    summary: {
      enrolled_members: memberCount,
      active_members: memberRecords.length,
      total_points_balance: memberRecords.reduce(
        (sum, item) => sum + item.points_balance,
        0
      ),
      total_points_issued: totalPointsIssued,
      total_points_redeemed: totalPointsRedeemed,
      active_rewards: rewardList.length,
      cashback_pending: (redemptions as Array<Record<string, unknown>>).filter(
        (entry) =>
          String(entry.redemption_type ?? "") === "mpesa_cashback" &&
          String(entry.status ?? "") === "processing"
      ).length,
      tier_breakdown: tierCounts,
      redemption_rate:
        ledgerRecords.length === 0
          ? 0
          : Number(
              ((ledgerRecords.filter((entry) => String(entry.entry_type) === "redeem").length /
                          ledgerRecords.length) *
                      100)
                  .toFixed(1)
            ),
    },
    members: memberRecords,
    rewards: rewardList,
    recent_ledger: ledgerRecords.map((entry) => ({
      id: entry.id,
      member_id: entry.member_id,
      member_name: memberById.get(String(entry.member_id ?? ""))?.full_name ?? "Member",
      entry_type: entry.entry_type,
      points_delta: Number(entry.points_delta ?? 0),
      points_balance_after: Number(entry.points_balance_after ?? 0),
      reward_name: entry.reward_name ?? null,
      reward_id: entry.reward_id ?? null,
      sale_id: entry.sale_id ?? null,
      sale_snapshot_id: entry.sale_snapshot_id ?? null,
      notes: entry.notes ?? null,
      timestamp: entry.timestamp ?? null,
    })),
    recent_redemptions: (redemptions as Array<Record<string, unknown>>).map((entry) => ({
      id: entry.id,
      member_id: entry.member_id,
      member_name: memberById.get(String(entry.member_id ?? ""))?.full_name ?? "Member",
      reward_id: entry.reward_id,
      redemption_type: entry.redemption_type,
      points_redeemed: toNumber(entry.points_redeemed),
      value_received: toNumber(entry.value_received),
      status: entry.status,
      redeemed_at: entry.redeemed_at,
      mpesa_phone: entry.mpesa_phone ?? null,
      voucher_code: entry.voucher_code ?? null,
    })),
  })
}
