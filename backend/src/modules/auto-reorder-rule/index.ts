import { Module } from "@medusajs/framework/utils"
import AutoReorderRuleModuleService from "./service"

export const AUTO_REORDER_RULE_MODULE = "auto_reorder_rule"

export default Module(AUTO_REORDER_RULE_MODULE, {
  service: AutoReorderRuleModuleService,
})
