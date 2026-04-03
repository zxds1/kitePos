import { model } from "@medusajs/framework/utils"

const ReturnRequest = model.define("return_request", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  supplier_shop_id: model.text().nullable(),
  customer_id: model.text().nullable(),
  order_reference: model.text().nullable(),
  sale_snapshot_id: model.text().nullable(),
  original_sale_id: model.text().nullable(),
  original_order_id: model.text().nullable(),
  return_number: model.text().nullable(),
  return_type: model
    .enum(["b2c_customer", "b2b_retailer", "online_order", "manual"])
    .default("manual"),
  customer_name: model.text().nullable(),
  item_name: model.text(),
  items: model.json().nullable(),
  reason: model.text(),
  return_reason: model.text().nullable(),
  return_reason_category: model
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
  item_condition: model
    .enum(["new", "opened", "used", "damaged", "expired"])
    .default("new"),
  amount: model.bigNumber().default(0),
  total_amount: model.bigNumber().default(0),
  refund_amount: model.bigNumber().default(0),
  restocking_fee: model.bigNumber().default(0),
  status: model
    .enum([
      "pending",
      "approved",
      "denied",
      "rejected",
      "received",
      "inspected",
      "refunded",
      "completed",
      "cancelled",
    ])
    .default("pending"),
  resolution: model
    .enum([
      "store_credit",
      "original_payment",
      "exchange",
      "bank_transfer",
      "cash",
      "mpesa",
    ])
    .default("store_credit"),
  return_method: model
    .enum(["pickup", "drop_off", "delivery"])
    .default("drop_off"),
  return_shipping_cost: model.bigNumber().default(0),
  shipping_paid_by: model.enum(["seller", "buyer", "split"]).default("seller"),
  tracking_number: model.text().nullable(),
  notes: model.text().nullable(),
  customer_notes: model.text().nullable(),
  created_by: model.text().nullable(),
  decided_by: model.text().nullable(),
  approved_by: model.text().nullable(),
  decided_at: model.dateTime().nullable(),
  approved_at: model.dateTime().nullable(),
  rejected_at: model.dateTime().nullable(),
  rejection_reason: model.text().nullable(),
  received_at: model.dateTime().nullable(),
  received_by: model.text().nullable(),
  refund_status: model
    .enum(["pending", "processing", "completed", "failed"])
    .default("pending"),
  refund_transaction_id: model.text().nullable(),
  refunded_at: model.dateTime().nullable(),
  fraud_score: model.number().default(0),
  fraud_flags: model.json().nullable(),
  requested_at: model.dateTime(),
})

export default ReturnRequest
