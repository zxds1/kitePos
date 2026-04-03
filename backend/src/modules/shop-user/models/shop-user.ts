import { model } from "@medusajs/framework/utils"

const ShopUser = model.define("shop_user", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  phone_hash: model.text(),
  pin_hash: model.text().nullable(),
  full_name: model.text().nullable(),
  role: model.enum(["owner", "admin", "branch_manager", "cashier"]).default("cashier"),
  assigned_location_ids: model.json().nullable(),
  assigned_terminal_ids: model.json().nullable(),
  must_change_pin: model.boolean().default(false),
  device_hash: model.text().nullable(),
  invite_code_hash: model.text().nullable(),
  invite_expires_at: model.dateTime().nullable(),
  recovery_code_hash: model.text().nullable(),
  recovery_expires_at: model.dateTime().nullable(),
  profile_image_url: model.text().nullable(),
  is_active: model.boolean().default(true),
  pin_updated_at: model.dateTime().nullable(),
  last_login_at: model.dateTime().nullable(),
})

export default ShopUser
