import { model } from "@medusajs/framework/utils"

const PurchaseOrder = model.define("purchase_order", {
  id: model.id().primaryKey(),
  retailer_shop_id: model.text(),
  supplier_shop_id: model.text(),
  supplier_id: model.text().nullable(),
  status: model
    .enum(["pending", "confirmed", "dispatched", "delivered", "cancelled"])
    .default("pending"),
  items: model.json(),
  subtotal_amount: model.number().default(0),
  total_amount: model.number().default(0),
  notes: model.text().nullable(),
  delivery_method: model
    .enum(["pickup", "delivery", "third_party"])
    .default("delivery"),
  delivery_fee: model.number().default(0),
  delivery_status: model
    .enum(["pending", "scheduled", "in_transit", "delivered", "failed"])
    .default("pending"),
  delivery_tracking_info: model.text().nullable(),
  payment_status: model
    .enum(["pending", "paid", "partial", "refunded", "cod"])
    .default("pending"),
  payment_due_date: model.dateTime().nullable(),
  mpesa_receipt: model.text().nullable(),
  auto_reorder_rule_id: model.text().nullable(),
  cancelled_at: model.dateTime().nullable(),
  cancellation_reason: model.text().nullable(),
  cancelled_by: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default PurchaseOrder
