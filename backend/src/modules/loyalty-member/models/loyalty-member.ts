import { model } from "@medusajs/framework/utils"

const LoyaltyMember = model.define("loyalty_member", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  full_name: model.text(),
  phone_number_hash: model.text().nullable(),
  phone_number: model.text(),
  date_of_birth: model.text().nullable(),
  referred_by_phone: model.text().nullable(),
  current_tier: model.text().default("silver"),
  next_tier: model.text().nullable(),
  points_to_next_tier: model.number().nullable(),
  tier_progress_points: model.number().default(0),
  stamps_collected: model.number().default(0),
  stamps_redeemed: model.number().default(0),
  referrals_count: model.number().default(0),
  points_pending: model.number().default(0),
  points_balance: model.number().default(0),
  total_points_earned: model.number().default(0),
  total_points_redeemed: model.number().default(0),
  is_active: model.boolean().default(true),
  opted_out: model.boolean().default(false),
  opted_out_at: model.dateTime().nullable(),
  enrolled_at: model.dateTime().nullable(),
  last_activity_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

export default LoyaltyMember
