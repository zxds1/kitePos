import { model } from "@medusajs/framework/utils"

const RefundTransaction = model.define("refund_transaction", {
  id: model.id().primaryKey(),
  return_id: model.text(),
  original_sale_id: model.text().nullable(),
  shop_id: model.text(),
  refund_amount: model.number(),
  restocking_fee: model.number().default(0),
  shipping_refund: model.number().default(0),
  total_refund: model.number(),
  refund_method: model
    .enum(["mpesa", "cash", "store_credit", "bank_transfer", "original_payment"])
    .default("store_credit"),
  mpesa_receipt: model.text().nullable(),
  bank_reference: model.text().nullable(),
  store_credit_id: model.text().nullable(),
  status: model
    .enum(["pending", "processing", "completed", "failed", "cancelled"])
    .default("pending"),
  processed_by: model.text().nullable(),
  processed_at: model.dateTime().nullable(),
  failed_reason: model.text().nullable(),
})

export default RefundTransaction
