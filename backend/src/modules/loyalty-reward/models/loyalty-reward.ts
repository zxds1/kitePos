import { model } from "@medusajs/framework/utils"

const LoyaltyReward = model.define("loyalty_reward", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  reward_name: model.text(),
  reward_type: model
    .enum(["discount", "free_item", "store_credit", "mpesa_cashback", "voucher"])
    .default("discount"),
  points_cost: model.number(),
  cash_value: model.number().default(0),
  reward_variant_id: model.text().nullable(),
  reward_quantity: model.number().default(1),
  discount_type: model.text().nullable(),
  discount_value: model.number().nullable(),
  min_purchase_amount: model.number().nullable(),
  max_redemptions_per_customer: model.number().nullable(),
  max_redemptions_total: model.number().nullable(),
  valid_from: model.dateTime().nullable(),
  valid_until: model.dateTime().nullable(),
  is_active: model.boolean().default(true),
  redemption_count: model.number().default(0),
  description: model.text().nullable(),
  terms_and_conditions: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default LoyaltyReward
