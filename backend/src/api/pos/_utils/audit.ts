import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { hashSecret } from "../../../utils/hash"
import { normalizeAuditMetadata } from "./audit-export"

type RecordAuditInput = {
  shop_id: string
  actor_user_id?: string | null
  actor_role?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  location_id?: string | null
  metadata?: Record<string, unknown> | null
}

export async function recordAuditLog(
  container: MedusaContainer,
  input: RecordAuditInput
) {
  const service = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  const [latest] = await service.listAndCountAuditLogs(
    { shop_id: input.shop_id },
    { take: 1, order: { created_at: "DESC" } }
  )
  const previousHash = latest[0]?.entry_hash ?? null
  const payload = JSON.stringify({
    shop_id: input.shop_id,
    actor_user_id: input.actor_user_id ?? null,
    actor_role: input.actor_role ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    location_id: input.location_id ?? null,
    metadata: normalizeAuditMetadata(input.metadata ?? null),
    previous_hash: previousHash,
  })
  const entryHash = hashSecret(payload, "audit")
  await service.createAuditLogs({
    id: `audit_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: input.shop_id,
    actor_user_id: input.actor_user_id ?? null,
    actor_role: input.actor_role ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    location_id: input.location_id ?? null,
    previous_hash: previousHash,
    entry_hash: entryHash,
    metadata: normalizeAuditMetadata(input.metadata ?? null),
  } as unknown as Record<string, unknown>)
}
