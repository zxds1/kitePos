import { model } from "@medusajs/framework/utils"

const LoyaltyRedemption = model.define("loyalty_redemption", {
  id: model.id().primaryKey(),
  member_id: model.text(),
  shop_id: model.text(),
  reward_id: model.text(),
  sale_id: model.text().nullable(),
  points_redeemed: model.number(),
  value_received: model.number().default(0),
  redemption_type: model
    .enum(["discount", "free_item", "store_credit", "mpesa_cashback", "voucher"])
    .default("discount"),
  status: model
    .enum(["pending", "processing", "completed", "cancelled", "expired"])
    .default("pending"),
  mpesa_phone: model.text().nullable(),
  mpesa_receipt: model.text().nullable(),
  voucher_code: model.text().nullable(),
  voucher_used: model.boolean().default(false),
  voucher_used_at: model.dateTime().nullable(),
  completed_at: model.dateTime().nullable(),
  cancelled_at: model.dateTime().nullable(),
  redeemed_at: model.dateTime(),
  metadata: model.json().nullable(),
})

export default LoyaltyRedemption
