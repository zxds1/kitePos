import { Module } from "@medusajs/framework/utils"
import LoyaltyRedemptionModuleService from "./service"

export const LOYALTY_REDEMPTION_MODULE = "loyalty_redemption"

export default Module(LOYALTY_REDEMPTION_MODULE, {
  service: LoyaltyRedemptionModuleService,
})
