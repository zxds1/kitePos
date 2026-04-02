import { model } from "@medusajs/framework/utils"

const ShopLocation = model.define("shop_location", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  name: model.text(),
  code: model.text(),
  address: model.text().nullable(),
  location_type: model.enum(["physical", "online", "shared"]).default("physical"),
  is_default: model.boolean().default(false),
  is_active: model.boolean().default(true),
  stock_location_id: model.text().nullable(),
  sales_channel_id: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default ShopLocation
