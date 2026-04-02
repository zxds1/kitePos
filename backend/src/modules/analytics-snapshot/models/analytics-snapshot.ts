import { model } from "@medusajs/framework/utils"

const AnalyticsSnapshot = model.define("analytics_snapshot", {
  id: model.id().primaryKey(),
  cache_key: model.text(),
  shop_id: model.text(),
  snapshot_type: model.enum(["summary", "product"]),
  variant_id: model.text().nullable(),
  range_start: model.dateTime(),
  range_end: model.dateTime(),
  payload: model.json(),
  computed_at: model.dateTime(),
})

export default AnalyticsSnapshot
