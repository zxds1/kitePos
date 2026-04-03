import { model } from "@medusajs/framework/utils"

const LoyaltyProgram = model.define("loyalty_program", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  program_name: model.text().default("UZA Rewards"),
  program_type: model
    .enum(["points", "tier", "cashback", "stamp", "hybrid"])
    .default("hybrid"),
  earn_rate: model.number().default(1),
  earn_rate_multiplier_weekend: model.number().default(1),
  earn_rate_multiplier_special: model.number().default(1),
  points_value: model.number().default(0.01),
  min_redemption_points: model.number().default(100),
  max_discount_percent: model.number().default(20),
  points_expire: model.boolean().default(false),
  expiry_days: model.number().default(365),
  has_tiers: model.boolean().default(true),
  tiers: model.json().nullable(),
  stamp_target: model.number().default(10),
  stamp_reward: model.text().nullable(),
  cashback_percent: model.number().default(2),
  cashback_method: model.enum(["store_credit", "mpesa"]).default("store_credit"),
  cashback_min_purchase: model.number().default(500),
  referral_bonus_points: model.number().default(100),
  referral_signup_bonus: model.number().default(50),
  auto_enroll: model.boolean().default(true),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default LoyaltyProgram
