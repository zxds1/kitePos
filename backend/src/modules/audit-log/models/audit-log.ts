import { model } from "@medusajs/framework/utils"

const AuditLog = model.define("audit_log", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  actor_user_id: model.text().nullable(),
  actor_role: model.text().nullable(),
  action: model.text(),
  entity_type: model.text(),
  entity_id: model.text().nullable(),
  location_id: model.text().nullable(),
  previous_hash: model.text().nullable(),
  entry_hash: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default AuditLog
