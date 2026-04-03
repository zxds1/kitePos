import { model } from "@medusajs/framework/utils"

const InventoryConfig = model.define("inventory_config", {
  id: model.id().primaryKey(),
  shop_id: model.text().nullable(),
  variant_id: model.text(),

  // Core Type
  inventory_type: model.enum([
    "discrete",
    "bulk_loose",
    "bulk_liquid",
    "multi_pack",
    "expiry_tracked",
  ]),

  // Purchase Unit Config
  purchase_unit: model.text(),
  purchase_value: model.bigNumber(),

  // Selling Units
  selling_units: model.json(),

  // Thresholds
  low_stock_threshold: model.bigNumber(),

  // Shared industry attributes
  brand: model.text().nullable(),
  style_code: model.text().nullable(),

  // Fashion
  size: model.text().nullable(),
  color: model.text().nullable(),
  gender: model.enum(["men", "women", "unisex", "boys", "girls"]).nullable(),
  material: model.text().nullable(),

  // Electronics
  imei: model.text().nullable(),
  serial_number: model.text().nullable(),
  model_name: model.text().nullable(),
  storage_capacity: model.text().nullable(),
  device_condition: model.enum(["new", "refurbished", "used"]).default("new"),
  warranty_enabled: model.boolean().default(false),
  warranty_months: model.number().nullable(),

  // Returns
  is_returnable: model.boolean().default(true),
  return_window_days: model.number().default(7),

  // Status
  is_active: model.boolean().default(true),
})

export default InventoryConfig
