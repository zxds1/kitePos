import { model } from "@medusajs/framework/utils"

const TaxReportRun = model.define("tax_report_run", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  report_type: model.enum(["vat", "income", "paye"]).default("vat"),
  branch_scope: model.text().nullable(),
  period_start: model.dateTime(),
  period_end: model.dateTime(),
  vat_rate_percent: model.number().default(16),
  status: model.enum(["completed"]).default("completed"),
  payload: model.json(),
  generated_by: model.text().nullable(),
  generated_at: model.dateTime(),
})

export default TaxReportRun
