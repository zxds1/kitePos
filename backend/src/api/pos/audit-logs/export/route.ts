import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"
import {
  shapeAuditLogEntry,
  verifyAuditChain,
} from "../../_utils/audit-export"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can export audit logs",
    })
    return
  }

  const service: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  const [logs] = await service.listAndCountAuditLogs(
    { shop_id: auth.shop_id },
    { take: 1000, order: { created_at: "ASC" } }
  )

  const verification = verifyAuditChain(logs)

  res.status(200).json({
    success: true,
    export: {
      exported_at: new Date().toISOString(),
      shop_id: auth.shop_id,
      total_entries: logs.length,
      chain_valid: verification.valid,
      verification,
      latest_entry_hash: logs[logs.length - 1]?.entry_hash ?? null,
      entries: logs.map((entry) =>
        shapeAuditLogEntry(entry, { includeHashes: true })
      ),
    },
  })
}
