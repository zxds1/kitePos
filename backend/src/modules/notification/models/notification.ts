import { model } from "@medusajs/framework/utils"

const Notification = model.define("notification", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  user_type: model.enum(["retailer", "supplier", "admin"]).default("retailer"),
  type: model
    .enum([
      "new_order",
      "order_confirmed",
      "order_dispatched",
      "order_delivered",
      "low_stock",
      "reorder_suggestion",
      "connection_request",
      "price_change",
      "new_return_request",
      "b2b_return_request",
      "return_approved",
      "return_rejected",
      "refund_processed",
      "return_received",
    ])
    .default("new_order"),
  title: model.text(),
  message: model.text(),
  data: model.json().nullable(),
  push_sent: model.boolean().default(false),
  sms_sent: model.boolean().default(false),
  email_sent: model.boolean().default(false),
  in_app_read: model.boolean().default(false),
  read_at: model.dateTime().nullable(),
})

export default Notification
