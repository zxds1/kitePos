import { model } from "@medusajs/framework/utils"

const Restock = model.define("restock", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  location_id: model.text().nullable(),
  variant_id: model.text(),
  idempotency_key: model.text().nullable(),

  // Quantity
  quantity_received: model.bigNumber(),
  purchase_unit_qty: model.bigNumber(),

  // Cost
  cost_per_unit: model.bigNumber(),
  total_cost: model.bigNumber(),

  // Receipt Data
  source: model.enum([
    "manual",
    "barcode_scan",
    "receipt_scan",
  ]),
  receipt_image_url: model.text().nullable(),
  receipt_raw_text: model.text().nullable(),
  supplier_name: model.text().nullable(),
  sales_channel: model.text().default("pos"),
  size: model.text().nullable(),
  color: model.text().nullable(),
  imei_list: model.json().nullable(),
  model_name: model.text().nullable(),

  // Snapshot
  conversion_snapshot: model.json(),

  timestamp: model.dateTime(),
})

export default Restock
