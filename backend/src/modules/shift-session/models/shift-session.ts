import { model } from "@medusajs/framework/utils"

const ShiftSession = model.define("shift_session", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  location_id: model.text().nullable(),
  terminal_id: model.text().nullable(),
  staff_user_id: model.text().nullable(),
  opening_cash: model.bigNumber().default(0),
  expected_cash: model.bigNumber().default(0),
  counted_cash: model.bigNumber().nullable(),
  digital_total: model.bigNumber().default(0),
  cash_sales_total: model.bigNumber().default(0),
  total_transactions: model.number().default(0),
  status: model.enum(["active", "closed"]).default("active"),
  manager_note: model.text().nullable(),
  opened_at: model.dateTime(),
  closed_at: model.dateTime().nullable(),
})

export default ShiftSession
