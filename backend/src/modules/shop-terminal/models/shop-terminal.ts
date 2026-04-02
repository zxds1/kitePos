import { model } from "@medusajs/framework/utils"

const ShopTerminal = model.define("shop_terminal", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  location_id: model.text(),
  name: model.text(),
  code: model.text(),
  assigned_user_id: model.text().nullable(),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default ShopTerminal
