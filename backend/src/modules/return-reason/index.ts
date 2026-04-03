import { Module } from "@medusajs/framework/utils"
import ReturnReasonModuleService from "./service"

export const RETURN_REASON_MODULE = "return_reason_catalog"

export default Module(RETURN_REASON_MODULE, {
  service: ReturnReasonModuleService,
})
