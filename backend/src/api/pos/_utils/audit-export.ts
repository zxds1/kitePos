import { hashSecret } from "../../../utils/hash"

type AuditLogRecord = {
  id?: string | null
  shop_id?: string | null
  actor_user_id?: string | null
  actor_role?: string | null
  action?: string | null
  entity_type?: string | null
  entity_id?: string | null
  location_id?: string | null
  previous_hash?: string | null
  entry_hash?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: Date | string | null
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys)
  }

  if (!value || typeof value !== "object") {
    return value
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortObjectKeys((value as Record<string, unknown>)[key])
      return acc
    }, {})
}

export function normalizeAuditMetadata(
  metadata: AuditLogRecord["metadata"]
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  return sortObjectKeys(metadata) as Record<string, unknown>
}

export function computeAuditEntryHash(entry: AuditLogRecord) {
  const payload = JSON.stringify({
    shop_id: entry.shop_id ?? null,
    actor_user_id: entry.actor_user_id ?? null,
    actor_role: entry.actor_role ?? null,
    action: entry.action ?? null,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    location_id: entry.location_id ?? null,
    metadata: normalizeAuditMetadata(entry.metadata),
    previous_hash: entry.previous_hash ?? null,
  })

  return hashSecret(payload, "audit")
}

export function shapeAuditLogEntry(
  entry: AuditLogRecord,
  options?: { includeHashes?: boolean }
) {
  const includeHashes = options?.includeHashes === true

  const shaped: {
    [key: string]: unknown
  } = {
    id: entry.id ?? null,
    shop_id: entry.shop_id ?? null,
    actor_user_id: entry.actor_user_id ?? null,
    actor_role: entry.actor_role ?? null,
    action: entry.action ?? null,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    location_id: entry.location_id ?? null,
    metadata: normalizeAuditMetadata(entry.metadata),
    created_at:
      entry.created_at instanceof Date
        ? entry.created_at.toISOString()
        : (entry.created_at ?? null),
  }

  if (includeHashes) {
    shaped.previous_hash = entry.previous_hash ?? null
    shaped.entry_hash = entry.entry_hash ?? null
  }

  return shaped
}

export function verifyAuditChain(entries: AuditLogRecord[]) {
  let previousHash: string | null = null

  for (const entry of entries) {
    const storedPreviousHash = entry.previous_hash ?? null
    const storedEntryHash = entry.entry_hash ?? null
    const expectedEntryHash = computeAuditEntryHash({
      ...entry,
      previous_hash: storedPreviousHash,
    })

    if (storedPreviousHash !== previousHash) {
      return {
        valid: false,
        broken_at_id: entry.id ?? null,
        reason: "previous_hash_mismatch",
        expected_previous_hash: previousHash,
        actual_previous_hash: storedPreviousHash,
      }
    }

    if (storedEntryHash !== expectedEntryHash) {
      return {
        valid: false,
        broken_at_id: entry.id ?? null,
        reason: "entry_hash_mismatch",
        expected_entry_hash: expectedEntryHash,
        actual_entry_hash: storedEntryHash,
      }
    }

    previousHash = storedEntryHash
  }

  return {
    valid: true,
    broken_at_id: null,
    reason: null,
    expected_previous_hash: previousHash,
    actual_previous_hash: previousHash,
  }
}
