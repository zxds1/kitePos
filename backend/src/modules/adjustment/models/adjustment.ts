import { model } from "@medusajs/framework/utils"

const Adjustment = model.define("adjustment", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  variant_id: model.text(),
  adjustment_type: model.enum([
    "correction",
    "wastage",
    "theft",
    "expiry",
    "other",
  ]),
  quantity_change: model.bigNumber(),
  reason: model.text(),
  reference: model.text().nullable(),
  before_stock: model.bigNumber(),
  after_stock: model.bigNumber(),
  evidence_url: model.text().nullable(),
  timestamp: model.dateTime(),
})

export default Adjustment
