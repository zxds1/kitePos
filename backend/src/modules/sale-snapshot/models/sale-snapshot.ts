import { model } from "@medusajs/framework/utils"

const SaleSnapshot = model.define("sale_snapshot", {
  id: model.id().primaryKey(),
  client_transaction_id: model.text().nullable(),
  order_id: model.text(),
  line_item_id: model.text(),
  shop_id: model.text(),
  variant_id: model.text(),

  // Conversion Details
  inventory_type: model.text(),
  unit_sold: model.text(),
  quantity_sold: model.bigNumber().default(1),
  conversion_factor_snapshot: model.bigNumber(),
  deduction_value: model.bigNumber(),
  price_charged: model.bigNumber().default(0),
  payment_method: model.text().default("cash"),
  mpesa_receipt_number: model.text().nullable(),
  mpesa_customer_phone: model.text().nullable(),
  amount_paid: model.bigNumber().default(0),

  // Stock State
  stock_before: model.bigNumber(),
  stock_after: model.bigNumber(),
  sync_status: model.text().default("success"),
  sync_conflict: model.json().nullable(),

  timestamp: model.dateTime(),
})

export default SaleSnapshot
