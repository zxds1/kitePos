import { model } from "@medusajs/framework/utils"

const TaxReport = model.define("tax_report", {
  id: model.id().primaryKey(),
  report_type: model.enum([
    "vat_summary",
    "sales_day_book",
    "purchases_day_book",
    "stock_report",
    "income_tax_estimate",
    "turnover_tax",
  ]),
  report_period: model.text(),
  shop_id: model.text(),
  report_data: model.json(),
  export_format: model.enum(["pdf", "excel", "csv", "json"]).default("json"),
  export_url: model.text().nullable(),
  kra_submission_ready: model.boolean().default(false),
  kra_submission_format: model.text().nullable(),
  status: model.enum(["generated", "reviewed", "submitted", "archived"]).default("generated"),
  generated_at: model.dateTime(),
  generated_by: model.text().nullable(),
})

export default TaxReport
