import { model } from "@medusajs/framework/utils"

const DataExportLog = model.define("data_export_log", {
  id: model.id().primaryKey(),
  partner_id: model.text(),
  query_params: model.json(),
  result_row_count: model.number(),
  format: model.enum(["csv", "json", "api"]).default("api"),
  data_type: model.text(),
  consent_verified: model.boolean().default(true),
  min_aggregation_threshold: model.number().default(10),
  pii_filtered: model.boolean().default(true),
  aggregation_threshold_met: model.boolean().default(true),
  quota_used: model.number().default(0),
  billing_amount: model.number().default(0),
  requested_at: model.dateTime(),
  completed_at: model.dateTime().nullable(),
  expires_at: model.dateTime().nullable(),
  ip_address: model.text().nullable(),
  user_agent: model.text().nullable(),
  status: model.enum(["pending", "completed", "failed", "rejected"]).default("pending"),
  error_message: model.text().nullable(),
})

export default DataExportLog
