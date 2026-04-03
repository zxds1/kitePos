import { model } from "@medusajs/framework/utils"

const ReturnReason = model.define("return_reason_catalog", {
  id: model.id().primaryKey(),
  reason_code: model.text(),
  reason_label: model.text(),
  reason_category: model
    .enum([
      "defective",
      "expired",
      "wrong_item",
      "damaged",
      "overstock",
      "customer_change",
      "other",
    ])
    .default("other"),
  description: model.text().nullable(),
  is_active: model.boolean().default(true),
  requires_photo: model.boolean().default(false),
  auto_approve: model.boolean().default(false),
  restocking_fee_percent: model.number().default(0),
  applies_to_b2c: model.boolean().default(true),
  applies_to_b2b: model.boolean().default(true),
  applies_to_online: model.boolean().default(true),
})

export default ReturnReason
