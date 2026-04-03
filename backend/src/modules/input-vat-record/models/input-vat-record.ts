import { model } from "@medusajs/framework/utils"

const InputVatRecord = model.define("input_vat_record", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  supplier_shop_id: model.text().nullable(),
  purchase_order_id: model.text().nullable(),
  restock_id: model.text().nullable(),
  supplier_invoice_number: model.text(),
  supplier_invoice_date: model.dateTime(),
  supplier_kra_pin: model.text().nullable(),
  supplier_name: model.text(),
  supplier_vat_number: model.text().nullable(),
  purchase_amount: model.bigNumber().default(0),
  vat_rate: model.number().default(16),
  vat_amount: model.bigNumber().default(0),
  total_amount: model.bigNumber().default(0),
  vat_claimed: model.boolean().default(false),
  vat_claim_period: model.text().nullable(),
  vat_disallowed: model.boolean().default(false),
  disallow_reason: model.text().nullable(),
  invoice_image_url: model.text().nullable(),
  invoice_verified: model.boolean().default(false),
})

export default InputVatRecord
