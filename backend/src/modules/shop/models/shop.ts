import { model } from "@medusajs/framework/utils"

const Shop = model.define("shop", {
  id: model.id().primaryKey(),

  // Identity (Privacy First)
  shop_name: model.text(),
  owner_phone_hash: model.text(),
  owner_name: model.text().nullable(),

  // Location (For Data Monetization)
  region_code: model.text(),
  ward_code: model.text(),
  category: model.text().nullable(),
  address: model.text().nullable(),
  business_license: model.text().nullable(),

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
})

export default Shop
