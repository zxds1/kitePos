import { model } from "@medusajs/framework/utils"

const Partner = model.define("partner", {
  id: model.id().primaryKey(),
  name: model.text(),
  contact_email: model.text(),
  contact_phone: model.text().nullable(),
  company_registration: model.text().nullable(),
  api_key_hash: model.text(),
  api_key_last4: model.text(),
  permissions: model.json(),
  rate_limit: model.number().default(100),
  quota_monthly: model.number().default(10000),
  billing_tier: model.enum(["free", "basic", "premium", "enterprise"]).default("free"),
  billing_email: model.text(),
  stripe_customer_id: model.text().nullable(),
  is_active: model.boolean().default(true),
  is_verified: model.boolean().default(false),
  approved_by: model.text().nullable(),
  last_accessed_at: model.dateTime().nullable(),
})

export default Partner
