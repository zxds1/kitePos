import { model } from "@medusajs/framework/utils"

const InventoryConfig = model.define("inventory_config", {
  id: model.id().primaryKey(),
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

  // Status
  is_active: model.boolean().default(true),
})

export default InventoryConfig
