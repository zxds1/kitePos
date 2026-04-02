import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { canManageBranches } from "../../auth/_utils/shop-users"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { shapeAuditLogEntry } from "../_utils/audit-export"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can view audit logs",
    })
    return
  }

  const service: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  const [logs] = await service.listAndCountAuditLogs(
    { shop_id: auth.shop_id },
    { take: 100, order: { created_at: "DESC" } }
  )

  res.status(200).json({
    success: true,
    logs: logs.map((entry) => shapeAuditLogEntry(entry)),
  })
}
