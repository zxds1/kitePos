import { MedusaService } from "@medusajs/framework/utils"
import AuditLog from "./models/audit-log"

class AuditLogModuleService extends MedusaService({
  AuditLog,
}) {}

export default AuditLogModuleService
