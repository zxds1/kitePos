import { model } from "@medusajs/framework/utils"

const LoyaltyLedger = model.define("loyalty_ledger", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  member_id: model.text(),
  entry_type: model
    .enum([
      "earn",
      "redeem",
      "adjust",
      "referral_bonus",
      "signup_bonus",
      "birthday_bonus",
      "promotional",
      "expire",
      "return_reversal",
      "cashback",
    ])
    .default("earn"),
  points_delta: model.number(),
  points_balance_after: model.number().nullable(),
  reward_name: model.text().nullable(),
  reward_id: model.text().nullable(),
  redemption_id: model.text().nullable(),
  return_request_id: model.text().nullable(),
  notes: model.text().nullable(),
  purchase_amount: model.number().nullable(),
  earn_rate_applied: model.number().nullable(),
  redemption_type: model.text().nullable(),
  redemption_value: model.number().nullable(),
  expires_at: model.dateTime().nullable(),
  expired_at: model.dateTime().nullable(),
  fraud_flag: model.boolean().default(false),
  fraud_reason: model.text().nullable(),
  sale_snapshot_id: model.text().nullable(),
  sale_id: model.text().nullable(),
  created_by: model.text().nullable(),
  timestamp: model.dateTime(),
})

export default LoyaltyLedger
