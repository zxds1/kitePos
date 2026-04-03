import { model } from "@medusajs/framework/utils"

const Supplier = model.define("supplier", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  supplier_shop_id: model.text().nullable(),
  name: model.text(),
  category: model.text().default("general"),
  contact_email: model.text().nullable(),
  contact_phone: model.text().nullable(),
  billing_tier: model.enum(["standard", "premium", "strategic"]).default("standard"),
  lead_time_days: model.number().default(3),
  notes: model.text().nullable(),
  delivery_options: model.json().nullable(),
  accepts_auto_reorder: model.boolean().default(false),
  preferred: model.boolean().default(false),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default Supplier
