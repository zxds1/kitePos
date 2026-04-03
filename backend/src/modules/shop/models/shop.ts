import { model } from "@medusajs/framework/utils"

const Shop = model.define("shop", {
  id: model.id().primaryKey(),

  // Identity (Privacy First)
  shop_name: model.text(),
  owner_phone_hash: model.text(),
  owner_name: model.text().nullable(),
  shop_type: model.text().default("retail_duka"),
  industry_types: model.json().nullable(),
  industry_features: model.json().nullable(),

  // Location (For Data Monetization)
  region_code: model.text(),
  ward_code: model.text(),
  category: model.text().nullable(),
  address: model.text().nullable(),
  business_license: model.text().nullable(),
  profile_image_url: model.text().nullable(),
  is_supplier: model.boolean().default(false),
  supplier_verified: model.boolean().default(false),
  supplier_categories: model.json().nullable(),
  supplier_description: model.text().nullable(),
  years_in_business: model.number().nullable(),
  delivery_options: model.json().nullable(),
  return_policy: model.json().nullable(),
  b2b_return_policy: model.json().nullable(),
  online_return_policy: model.json().nullable(),

  // Compliance (ODPC)
  consent_given: model.boolean().default(false),
  consent_timestamp: model.dateTime().nullable(),
  consent_version: model.text().nullable(),
  data_sharing_consent: model.boolean().default(false),
  analytics_consent: model.boolean().default(false),

  // Status
  is_active: model.boolean().default(true),

  // Payment Configuration
  mpesa_phone: model.text().nullable(),
  mpesa_till: model.text().nullable(),
  mpesa_paybill: model.text().nullable(),
  accept_mpesa: model.boolean().default(true),
  mpesa_display_name: model.text().nullable(),

  // Tax Configuration
  kra_pin: model.text().nullable(),
  vat_registered: model.boolean().default(false),
  vat_registration_number: model.text().nullable(),
  tax_type: model.enum(["vat", "turnover_tax", "exempt"]).default("exempt"),
  turnover_threshold: model.number().default(0),
  tims_enabled: model.boolean().default(false),
  tims_device_id: model.text().nullable(),
  etr_serial_number: model.text().nullable(),
  invoice_prefix: model.text().default("INV"),
  invoice_number_sequence: model.number().default(1),
  tax_invoice_enabled: model.boolean().default(false),
  whvat_applicable: model.boolean().default(false),
  whvat_registration: model.text().nullable(),
  tax_reporting_email: model.text().nullable(),
  last_vat_return_filed: model.dateTime().nullable(),
  last_vat_return_period: model.text().nullable(),
})

export default Shop
