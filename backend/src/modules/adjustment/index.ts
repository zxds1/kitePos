import { Module } from "@medusajs/framework/utils"
import AdjustmentModuleService from "./service"

export const ADJUSTMENT_MODULE = "adjustment"

export default Module(ADJUSTMENT_MODULE, {
  service: AdjustmentModuleService,
})
