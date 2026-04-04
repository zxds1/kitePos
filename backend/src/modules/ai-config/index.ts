import { Module } from "@medusajs/framework/utils"
import AIConfigModuleService from "./service"

export const AI_CONFIG_MODULE = "ai_config"

export default Module(AI_CONFIG_MODULE, {
  service: AIConfigModuleService,
})
