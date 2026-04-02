import { Module } from "@medusajs/framework/utils"
import AuditLogModuleService from "./service"

export const AUDIT_LOG_MODULE = "audit_log"

export default Module(AUDIT_LOG_MODULE, {
  service: AuditLogModuleService,
})
