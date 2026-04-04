import { Module } from "@medusajs/framework/utils"
import AIOperationLogModuleService from "./service"

export const AI_OPERATION_LOG_MODULE = "ai_operation_log"

export default Module(AI_OPERATION_LOG_MODULE, {
  service: AIOperationLogModuleService,
})
