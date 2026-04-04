import { model } from "@medusajs/framework/utils"

const OnlineStore = model.define("online_store", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  slug: model.text(),
  subdomain: model.text(),
  public_url: model.text(),
  status: model.enum(["draft", "generating", "published", "failed"]).default("draft"),
  theme_name: model.text().default("smart-modern"),
  theme_config: model.json().nullable(),
  storefront_content: model.json().nullable(),
  seo_metadata: model.json().nullable(),
  sharing_metadata: model.json().nullable(),
  last_generated_at: model.dateTime().nullable(),
  generation_error: model.text().nullable(),
  is_active: model.boolean().default(true),
})

export default OnlineStore
