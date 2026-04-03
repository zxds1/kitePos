import { Module } from "@medusajs/framework/utils"
import LoyaltyProgramModuleService from "./service"

export const LOYALTY_PROGRAM_MODULE = "loyalty_program"

export default Module(LOYALTY_PROGRAM_MODULE, {
  service: LoyaltyProgramModuleService,
})
