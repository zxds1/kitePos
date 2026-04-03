import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { LOYALTY_LEDGER_MODULE } from "../modules/loyalty-ledger"
import type LoyaltyLedgerModuleService from "../modules/loyalty-ledger/service"
import { LOYALTY_MEMBER_MODULE } from "../modules/loyalty-member"
import type LoyaltyMemberModuleService from "../modules/loyalty-member/service"
import { LOYALTY_PROGRAM_MODULE } from "../modules/loyalty-program"
import type LoyaltyProgramModuleService from "../modules/loyalty-program/service"
import { LOYALTY_REDEMPTION_MODULE } from "../modules/loyalty-redemption"
import type LoyaltyRedemptionModuleService from "../modules/loyalty-redemption/service"
import { LOYALTY_REWARD_MODULE } from "../modules/loyalty-reward"
import type LoyaltyRewardModuleService from "../modules/loyalty-reward/service"
import { hashPhone, normalizeKenyanPhone } from "../utils/hash"

type LoyaltyProgramRecord = Record<string, unknown>
type LoyaltyMemberRecord = Record<string, unknown>
type LoyaltyRewardRecord = Record<string, unknown>
type LoyaltyRedemptionRecord = Record<string, unknown>

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length ? value : fallback
}

function normalizeTierValue(value: unknown) {
  const tier = toText(value, "silver").toLowerCase()
  if (["silver", "gold", "platinum", "bronze"].includes(tier)) {
    return tier
  }
  return "silver"
}

function buildDefaultTiers() {
  return [
    {
      name: "silver",
      label: "Silver",
      min_points: 0,
      multiplier: 1,
      benefits: ["1x points", "Member pricing"],
    },
    {
      name: "gold",
      label: "Gold",
      min_points: 1000,
      multiplier: 1.5,
      benefits: ["1.5x points", "Priority service"],
    },
    {
      name: "platinum",
      label: "Platinum",
      min_points: 5000,
      multiplier: 2,
      benefits: ["2x points", "Free delivery", "Exclusive offers"],
    },
  ]
}

function normalizeTierConfig(program: LoyaltyProgramRecord) {
  const raw = Array.isArray(program.tiers) ? program.tiers : []
  const tiers = (raw.length ? raw : buildDefaultTiers())
    .map((entry) => {
      const tier = entry as Record<string, unknown>
      return {
        name: normalizeTierValue(tier.name ?? tier.label),
        label: toText(tier.label, toText(tier.name, "Silver")),
        min_points: toNumber(tier.min_points),
        multiplier: toNumber(tier.multiplier, tier.name === "gold" ? 1.5 : tier.name === "platinum" ? 2 : 1),
        benefits: Array.isArray(tier.benefits)
          ? tier.benefits.map((item) => String(item))
          : [],
      }
    })
    .sort((left, right) => left.min_points - right.min_points)

  return tiers
}

export class LoyaltyService {
  constructor(private readonly scope: MedusaContainer) {}

  private memberService() {
    return this.scope.resolve<LoyaltyMemberModuleService>(LOYALTY_MEMBER_MODULE)
  }

  private ledgerService() {
    return this.scope.resolve<LoyaltyLedgerModuleService>(LOYALTY_LEDGER_MODULE)
  }

  private programService() {
    return this.scope.resolve<LoyaltyProgramModuleService>(LOYALTY_PROGRAM_MODULE)
  }

  private rewardService() {
    return this.scope.resolve<LoyaltyRewardModuleService>(LOYALTY_REWARD_MODULE)
  }

  private redemptionService() {
    return this.scope.resolve<LoyaltyRedemptionModuleService>(LOYALTY_REDEMPTION_MODULE)
  }

  async getOrCreateProgram(shopId: string) {
    const service = this.programService()
    const [programs] = await service.listAndCountLoyaltyPrograms(
      { shop_id: shopId, is_active: true },
      { take: 1, order: { created_at: "ASC" } }
    )
    const existing = programs[0] as LoyaltyProgramRecord | undefined
    if (existing) {
      return existing
    }

    return (await service.createLoyaltyPrograms({
      id: `lpr_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: shopId,
      program_name: "UZA Rewards",
      program_type: "hybrid",
      earn_rate: 1,
      earn_rate_multiplier_weekend: 1.5,
      earn_rate_multiplier_special: 1,
      points_value: 0.1,
      min_redemption_points: 100,
      max_discount_percent: 20,
      points_expire: false,
      expiry_days: 365,
      has_tiers: true,
      tiers: buildDefaultTiers(),
      stamp_target: 10,
      stamp_reward: "1 free loyalty item",
      cashback_percent: 2,
      cashback_method: "mpesa",
      cashback_min_purchase: 500,
      referral_bonus_points: 100,
      referral_signup_bonus: 50,
      auto_enroll: true,
      is_active: true,
    } as Record<string, unknown>)) as LoyaltyProgramRecord
  }

  async findMember(shopId: string, phoneNumber: string) {
    const normalizedPhone = normalizeKenyanPhone(phoneNumber)
    const [members] = await this.memberService().listAndCountLoyaltyMembers(
      {
        shop_id: shopId,
        phone_number_hash: hashPhone(normalizedPhone),
      },
      { take: 1 }
    )

    return (members[0] as LoyaltyMemberRecord | undefined) ?? null
  }

  private computeTierStatus(program: LoyaltyProgramRecord, totalPoints: number) {
    const tiers = normalizeTierConfig(program)
    let current = tiers[0]
    let nextTier: (typeof tiers)[number] | null = null

    for (const tier of tiers) {
      if (totalPoints >= tier.min_points) {
        current = tier
        continue
      }
      nextTier = tier
      break
    }

    return {
      tiers,
      current,
      nextTier,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.min_points - totalPoints) : 0,
    }
  }

  shapeProgram(program: LoyaltyProgramRecord) {
    const tiers = normalizeTierConfig(program)
    return {
      id: program.id,
      shop_id: program.shop_id,
      program_name: toText(program.program_name, "UZA Rewards"),
      program_type: toText(program.program_type, "hybrid"),
      earn_rate: toNumber(program.earn_rate, 1),
      weekend_multiplier: toNumber(program.earn_rate_multiplier_weekend, 1),
      special_multiplier: toNumber(program.earn_rate_multiplier_special, 1),
      points_value: toNumber(program.points_value, 0.1),
      min_redemption_points: toNumber(program.min_redemption_points, 100),
      max_discount_percent: toNumber(program.max_discount_percent, 20),
      cashback_percent: toNumber(program.cashback_percent, 2),
      cashback_method: toText(program.cashback_method, "mpesa"),
      cashback_min_purchase: toNumber(program.cashback_min_purchase, 500),
      referral_bonus_points: toNumber(program.referral_bonus_points, 100),
      referral_signup_bonus: toNumber(program.referral_signup_bonus, 50),
      stamp_target: toNumber(program.stamp_target, 10),
      stamp_reward: program.stamp_reward ?? null,
      auto_enroll: program.auto_enroll !== false,
      points_expire: Boolean(program.points_expire),
      expiry_days: toNumber(program.expiry_days, 365),
      has_tiers: program.has_tiers !== false,
      tiers,
    }
  }

  shapeMember(member: LoyaltyMemberRecord, program?: LoyaltyProgramRecord) {
    const activeProgram = program ?? null
    const tierStatus = activeProgram
      ? this.computeTierStatus(activeProgram, toNumber(member.total_points_earned))
      : null
    const currentTier = normalizeTierValue(member.current_tier ?? member.tier)

    return {
      id: String(member.id),
      full_name: toText(member.full_name, "Member"),
      phone_number: toText(member.phone_number),
      phone_number_hash: member.phone_number_hash ?? null,
      date_of_birth: member.date_of_birth ?? null,
      referred_by_phone: member.referred_by_phone ?? null,
      tier: currentTier,
      current_tier: currentTier,
      next_tier:
        toText(member.next_tier) ||
        tierStatus?.nextTier?.name ||
        null,
      points_to_next_tier:
        member.points_to_next_tier != null
          ? toNumber(member.points_to_next_tier)
          : tierStatus?.pointsToNextTier ?? null,
      tier_progress_points:
        member.tier_progress_points != null
          ? toNumber(member.tier_progress_points)
          : toNumber(member.total_points_earned),
      points_balance: toNumber(member.points_balance),
      points_pending: toNumber(member.points_pending),
      total_points_earned: toNumber(member.total_points_earned),
      total_points_redeemed: toNumber(member.total_points_redeemed),
      referrals_count: toNumber(member.referrals_count),
      stamps_collected: toNumber(member.stamps_collected),
      stamps_redeemed: toNumber(member.stamps_redeemed),
      is_active: member.is_active !== false,
      opted_out: Boolean(member.opted_out),
      enrolled_at: member.enrolled_at ?? member.created_at ?? null,
      last_activity_at: member.last_activity_at ?? member.updated_at ?? null,
    }
  }

  shapeReward(reward: LoyaltyRewardRecord, memberRedemptionCount = 0) {
    return {
      id: reward.id,
      reward_name: toText(reward.reward_name),
      reward_type: toText(reward.reward_type, "discount"),
      points_cost: toNumber(reward.points_cost),
      cash_value: toNumber(reward.cash_value),
      reward_quantity: toNumber(reward.reward_quantity, 1),
      discount_type: reward.discount_type ?? null,
      discount_value: reward.discount_value != null ? toNumber(reward.discount_value) : null,
      min_purchase_amount:
        reward.min_purchase_amount != null ? toNumber(reward.min_purchase_amount) : null,
      max_redemptions_per_customer:
        reward.max_redemptions_per_customer != null
          ? toNumber(reward.max_redemptions_per_customer)
          : null,
      max_redemptions_total:
        reward.max_redemptions_total != null ? toNumber(reward.max_redemptions_total) : null,
      valid_from: reward.valid_from ?? null,
      valid_until: reward.valid_until ?? null,
      description: reward.description ?? null,
      terms_and_conditions: reward.terms_and_conditions ?? null,
      is_active: reward.is_active !== false,
      redemption_count: toNumber(reward.redemption_count),
      member_redemption_count: memberRedemptionCount,
    }
  }

  async enrollMember(input: {
    shopId: string
    fullName: string
    phoneNumber: string
    tier?: string | null
    dateOfBirth?: string | null
    referredByPhone?: string | null
    createdBy?: string | null
  }) {
    const program = await this.getOrCreateProgram(input.shopId)
    const normalizedPhone = normalizeKenyanPhone(input.phoneNumber)
    const existing = await this.findMember(input.shopId, normalizedPhone)
    if (existing) {
      return {
        created: false,
        member: existing,
        program,
      }
    }

    const tierStatus = this.computeTierStatus(program, 0)
    const created = (await this.memberService().createLoyaltyMembers({
      id: `loy_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: input.shopId,
      full_name: input.fullName.trim(),
      phone_number: normalizedPhone,
      phone_number_hash: hashPhone(normalizedPhone),
      date_of_birth: input.dateOfBirth ?? null,
      referred_by_phone: input.referredByPhone ?? null,
      tier: normalizeTierValue(input.tier),
      current_tier: normalizeTierValue(input.tier ?? tierStatus.current.name),
      next_tier: tierStatus.nextTier?.name ?? null,
      points_to_next_tier: tierStatus.pointsToNextTier,
      tier_progress_points: 0,
      points_balance: toNumber(program.referral_signup_bonus),
      total_points_earned: toNumber(program.referral_signup_bonus),
      total_points_redeemed: 0,
      points_pending: 0,
      referrals_count: 0,
      stamps_collected: 0,
      stamps_redeemed: 0,
      is_active: true,
      opted_out: false,
      enrolled_at: new Date(),
      last_activity_at: new Date(),
    } as Record<string, unknown>)) as LoyaltyMemberRecord

    if (toNumber(program.referral_signup_bonus) > 0) {
      await this.recordLedger({
        shopId: input.shopId,
        memberId: String(created.id),
        entryType: "signup_bonus",
        pointsDelta: toNumber(program.referral_signup_bonus),
        pointsBalanceAfter: toNumber(created.points_balance),
        notes: "Signup bonus credited on enrolment.",
        createdBy: input.createdBy ?? null,
      })
    }

    if (input.referredByPhone) {
      const referrer = await this.findMember(input.shopId, input.referredByPhone)
      if (referrer) {
        const referrerBalance =
          toNumber(referrer.points_balance) + toNumber(program.referral_bonus_points)
        const referrerEarned =
          toNumber(referrer.total_points_earned) + toNumber(program.referral_bonus_points)
        await this.memberService().updateLoyaltyMembers({
          selector: { id: referrer.id },
          data: {
            points_balance: referrerBalance,
            total_points_earned: referrerEarned,
            referrals_count: toNumber(referrer.referrals_count) + 1,
            last_activity_at: new Date(),
          },
        })
        await this.recordLedger({
          shopId: input.shopId,
          memberId: String(referrer.id),
          entryType: "referral_bonus",
          pointsDelta: toNumber(program.referral_bonus_points),
          pointsBalanceAfter: referrerBalance,
          notes: `Referral bonus for inviting ${normalizedPhone}.`,
          createdBy: input.createdBy ?? null,
        })
      }
    }

    return {
      created: true,
      member: created,
      program,
    }
  }

  async recordLedger(input: {
    shopId: string
    memberId: string
    entryType: string
    pointsDelta: number
    pointsBalanceAfter?: number | null
    rewardName?: string | null
    rewardId?: string | null
    redemptionId?: string | null
    returnRequestId?: string | null
    purchaseAmount?: number | null
    earnRateApplied?: number | null
    redemptionType?: string | null
    redemptionValue?: number | null
    expiresAt?: Date | null
    notes?: string | null
    saleSnapshotId?: string | null
    saleId?: string | null
    createdBy?: string | null
    fraudFlag?: boolean
    fraudReason?: string | null
  }) {
    return this.ledgerService().createLoyaltyLedgers({
      id: `led_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: input.shopId,
      member_id: input.memberId,
      entry_type: input.entryType,
      points_delta: input.pointsDelta,
      points_balance_after: input.pointsBalanceAfter ?? null,
      reward_name: input.rewardName ?? null,
      reward_id: input.rewardId ?? null,
      redemption_id: input.redemptionId ?? null,
      return_request_id: input.returnRequestId ?? null,
      purchase_amount: input.purchaseAmount ?? null,
      earn_rate_applied: input.earnRateApplied ?? null,
      redemption_type: input.redemptionType ?? null,
      redemption_value: input.redemptionValue ?? null,
      expires_at: input.expiresAt ?? null,
      notes: input.notes ?? null,
      sale_snapshot_id: input.saleSnapshotId ?? null,
      sale_id: input.saleId ?? null,
      created_by: input.createdBy ?? null,
      fraud_flag: input.fraudFlag === true,
      fraud_reason: input.fraudReason ?? null,
      timestamp: new Date(),
    } as Record<string, unknown>)
  }

  async updateTierStatus(member: LoyaltyMemberRecord, program: LoyaltyProgramRecord, extra: Record<string, unknown> = {}) {
    const earned = toNumber(extra.total_points_earned ?? member.total_points_earned)
    const tierStatus = this.computeTierStatus(program, earned)
    const currentTier = tierStatus.current.name
    await this.memberService().updateLoyaltyMembers({
      id: String(member.id),
      current_tier: currentTier,
      tier: currentTier,
      next_tier: tierStatus.nextTier?.name ?? null,
      points_to_next_tier: tierStatus.nextTier ? tierStatus.pointsToNextTier : 0,
      tier_progress_points: earned,
      ...extra,
    } as Record<string, unknown>)

    return {
      currentTier,
      nextTier: tierStatus.nextTier?.name ?? null,
      pointsToNextTier: tierStatus.nextTier ? tierStatus.pointsToNextTier : 0,
    }
  }

  async processSaleEarn(input: {
    shopId: string
    saleSnapshotId: string
    saleId?: string | null
    phoneNumber?: string | null
    purchaseAmount: number
    saleTimestamp?: Date | null
    createdBy?: string | null
  }) {
    if (!input.phoneNumber) {
      return null
    }

    const program = await this.getOrCreateProgram(input.shopId)
    if (program.is_active === false) {
      return null
    }

    const normalizedPhone = normalizeKenyanPhone(input.phoneNumber)
    let member = await this.findMember(input.shopId, normalizedPhone)
    if (!member && program.auto_enroll !== false) {
      const enrolled = await this.enrollMember({
        shopId: input.shopId,
        fullName: "Walk-in member",
        phoneNumber: normalizedPhone,
        createdBy: input.createdBy ?? null,
      })
      member = enrolled.member
    }

    if (!member) {
      return null
    }

    const [existingEntries] = await this.ledgerService().listAndCountLoyaltyLedgers(
      {
        shop_id: input.shopId,
        member_id: String(member.id),
        sale_snapshot_id: input.saleSnapshotId,
        entry_type: "earn",
      },
      { take: 1 }
    )
    if (existingEntries[0]) {
      return null
    }

    let earnRate = toNumber(program.earn_rate, 1)
    const saleDate = input.saleTimestamp ?? new Date()
    const day = saleDate.getDay()
    if (day === 0 || day === 6) {
      earnRate *= toNumber(program.earn_rate_multiplier_weekend, 1)
    }
    const tierValue = normalizeTierValue(member.current_tier ?? member.tier)
    const tierConfig = normalizeTierConfig(program).find((tier) => tier.name === tierValue)
    const tierMultiplier = tierConfig?.multiplier ?? 1
    const pointsEarned = Math.max(0, Math.floor((input.purchaseAmount / 100) * earnRate * tierMultiplier))
    const nextBalance = toNumber(member.points_balance) + pointsEarned
    const totalEarned = toNumber(member.total_points_earned) + pointsEarned
    const stampsCollected = toNumber(member.stamps_collected) + 1
    const stampTarget = Math.max(1, toNumber(program.stamp_target, 10))
    const completedCard = stampsCollected >= stampTarget
    const normalizedStamps = completedCard ? 0 : stampsCollected
    const stampsRedeemed = completedCard
      ? toNumber(member.stamps_redeemed) + 1
      : toNumber(member.stamps_redeemed)

    const tierStatus = await this.updateTierStatus(member, program, {
      points_balance: nextBalance,
      total_points_earned: totalEarned,
      last_activity_at: new Date(),
      stamps_collected: normalizedStamps,
      stamps_redeemed: stampsRedeemed,
    })

    await this.recordLedger({
      shopId: input.shopId,
      memberId: String(member.id),
      entryType: "earn",
      pointsDelta: pointsEarned,
      pointsBalanceAfter: nextBalance,
      purchaseAmount: input.purchaseAmount,
      earnRateApplied: earnRate * tierMultiplier,
      notes: completedCard
        ? "Points earned and stamp card completed."
        : "Points earned from sale.",
      saleSnapshotId: input.saleSnapshotId,
      saleId: input.saleId ?? null,
      createdBy: input.createdBy ?? null,
      expiresAt:
        program.points_expire
          ? new Date(Date.now() + toNumber(program.expiry_days, 365) * 24 * 60 * 60 * 1000)
          : null,
    })

    return {
      memberId: member.id,
      pointsEarned,
      pointsBalance: nextBalance,
      currentTier: tierStatus.currentTier,
      nextTier: tierStatus.nextTier,
      pointsToNextTier: tierStatus.pointsToNextTier,
      stampRewardUnlocked: completedCard,
    }
  }

  async listRewards(shopId: string, memberId?: string | null) {
    const [rewards] = await this.rewardService().listAndCountLoyaltyRewards(
      { shop_id: shopId, is_active: true },
      { take: 100, order: { points_cost: "ASC" } }
    )

    const counts = new Map<string, number>()
    if (memberId) {
      const [redemptions] = await this.redemptionService().listAndCountLoyaltyRedemptions(
        { member_id: memberId },
        { take: 500 }
      )
      for (const redemption of redemptions as LoyaltyRedemptionRecord[]) {
        const rewardId = toText(redemption.reward_id)
        counts.set(rewardId, (counts.get(rewardId) ?? 0) + 1)
      }
    }

    return (rewards as LoyaltyRewardRecord[]).map((reward) =>
      this.shapeReward(reward, counts.get(String(reward.id)) ?? 0)
    )
  }

  async redeemReward(input: {
    shopId: string
    phoneNumber: string
    rewardId: string
    saleId?: string | null
    mpesaPhone?: string | null
    createdBy?: string | null
  }) {
    const member = await this.findMember(input.shopId, input.phoneNumber)
    if (!member) {
      throw new Error("Customer not enrolled")
    }

    const [rewards] = await this.rewardService().listAndCountLoyaltyRewards(
      { id: input.rewardId, shop_id: input.shopId, is_active: true },
      { take: 1 }
    )
    const reward = rewards[0] as LoyaltyRewardRecord | undefined
    if (!reward) {
      throw new Error("Reward not found")
    }

    const pointsCost = toNumber(reward.points_cost)
    if (toNumber(member.points_balance) < pointsCost) {
      throw new Error(`Insufficient points. Need ${pointsCost}, have ${toNumber(member.points_balance)}`)
    }

    const [memberRedemptions] = await this.redemptionService().listAndCountLoyaltyRedemptions(
      { member_id: String(member.id), reward_id: input.rewardId },
      { take: 500 }
    )

    if (
      reward.max_redemptions_per_customer != null &&
      memberRedemptions.length >= toNumber(reward.max_redemptions_per_customer)
    ) {
      throw new Error("Redemption limit reached for this reward")
    }

    const normalizedPhone = input.mpesaPhone
      ? normalizeKenyanPhone(input.mpesaPhone)
      : toText(member.phone_number)
    const redemptionType = toText(reward.reward_type, "discount")
    const status = redemptionType === "mpesa_cashback" ? "processing" : "completed"
    const nextBalance = toNumber(member.points_balance) - pointsCost
    const totalRedeemed = toNumber(member.total_points_redeemed) + pointsCost

    const redemption = (await this.redemptionService().createLoyaltyRedemptions({
      id: `lrd_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      member_id: member.id,
      shop_id: input.shopId,
      reward_id: input.rewardId,
      sale_id: input.saleId ?? null,
      points_redeemed: pointsCost,
      value_received: toNumber(reward.cash_value),
      redemption_type: redemptionType,
      status,
      mpesa_phone: redemptionType === "mpesa_cashback" ? normalizedPhone : null,
      redeemed_at: new Date(),
      completed_at: status === "completed" ? new Date() : null,
      voucher_code:
        redemptionType === "voucher"
          ? `UZA-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`
          : null,
    } as Record<string, unknown>)) as LoyaltyRedemptionRecord

    await this.memberService().updateLoyaltyMembers({
      selector: { id: member.id },
      data: {
        points_balance: nextBalance,
        total_points_redeemed: totalRedeemed,
        last_activity_at: new Date(),
      },
    })

    await this.rewardService().updateLoyaltyRewards({
      selector: { id: reward.id },
      data: {
        redemption_count: toNumber(reward.redemption_count) + 1,
      },
    })

    await this.recordLedger({
      shopId: input.shopId,
      memberId: String(member.id),
      entryType: redemptionType === "mpesa_cashback" ? "cashback" : "redeem",
      pointsDelta: -pointsCost,
      pointsBalanceAfter: nextBalance,
      rewardName: toText(reward.reward_name),
      rewardId: String(reward.id),
      redemptionId: String(redemption.id),
      redemptionType,
      redemptionValue: toNumber(reward.cash_value),
      saleId: input.saleId ?? null,
      createdBy: input.createdBy ?? null,
      notes:
        redemptionType === "mpesa_cashback"
          ? "Cashback queued on M-Pesa processing path."
          : "Reward redeemed successfully.",
    })

    return {
      member,
      reward,
      redemption,
      nextBalance,
    }
  }

  async reversePointsForReturn(input: {
    shopId: string
    returnRequestId: string
    saleSnapshotId?: string | null
    saleId?: string | null
    createdBy?: string | null
  }) {
    const [existingReversal] = await this.ledgerService().listAndCountLoyaltyLedgers(
      {
        shop_id: input.shopId,
        return_request_id: input.returnRequestId,
        entry_type: "return_reversal",
      },
      { take: 1 }
    )
    if (existingReversal[0]) {
      return null
    }

    const filters: Record<string, unknown> = {
      shop_id: input.shopId,
      entry_type: "earn",
    }
    if (input.saleSnapshotId) {
      filters.sale_snapshot_id = input.saleSnapshotId
    } else if (input.saleId) {
      filters.sale_id = input.saleId
    } else {
      return null
    }

    const [earnEntries] = await this.ledgerService().listAndCountLoyaltyLedgers(filters, { take: 20 })
    const earnEntry = (earnEntries[0] as Record<string, unknown> | undefined) ?? null
    if (!earnEntry) {
      return null
    }

    const [members] = await this.memberService().listAndCountLoyaltyMembers(
      { id: String(earnEntry.member_id), shop_id: input.shopId },
      { take: 1 }
    )
    const member = members[0] as LoyaltyMemberRecord | undefined
    if (!member) {
      return null
    }

    const reversalPoints = Math.min(
      toNumber(member.points_balance),
      Math.abs(toNumber(earnEntry.points_delta))
    )
    if (reversalPoints <= 0) {
      return null
    }

    const nextBalance = Math.max(0, toNumber(member.points_balance) - reversalPoints)
    await this.memberService().updateLoyaltyMembers({
      selector: { id: member.id },
      data: {
        points_balance: nextBalance,
        total_points_redeemed: toNumber(member.total_points_redeemed) + reversalPoints,
        last_activity_at: new Date(),
      },
    })

    await this.recordLedger({
      shopId: input.shopId,
      memberId: String(member.id),
      entryType: "return_reversal",
      pointsDelta: -reversalPoints,
      pointsBalanceAfter: nextBalance,
      returnRequestId: input.returnRequestId,
      saleSnapshotId: input.saleSnapshotId ?? null,
      saleId: input.saleId ?? null,
      createdBy: input.createdBy ?? null,
      notes: "Points reversed because the linked sale was refunded.",
    })

    return {
      memberId: member.id,
      pointsReversed: reversalPoints,
      pointsBalance: nextBalance,
    }
  }
}
