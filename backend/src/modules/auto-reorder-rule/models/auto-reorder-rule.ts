import { model } from "@medusajs/framework/utils"

const AutoReorderRule = model.define("auto_reorder_rule", {
  id: model.id().primaryKey(),
  retailer_shop_id: model.text(),
  supplier_shop_id: model.text(),
  variant_id: model.text(),
  trigger_type: model
    .enum(["stock_threshold", "schedule", "predictive"])
    .default("stock_threshold"),
  stock_threshold: model.number().nullable(),
  schedule_frequency_days: model.number().nullable(),
  last_ordered_at: model.dateTime().nullable(),
  order_quantity: model.number(),
  preferred_supplier: model.boolean().default(true),
  max_price: model.number().nullable(),
  auto_approve: model.boolean().default(false),
  budget_limit_monthly: model.number().nullable(),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default AutoReorderRule
