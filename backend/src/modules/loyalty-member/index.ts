import { Module } from "@medusajs/framework/utils"
import LoyaltyMemberModuleService from "./service"

export const LOYALTY_MEMBER_MODULE = "loyalty_member"

export default Module(LOYALTY_MEMBER_MODULE, {
  service: LoyaltyMemberModuleService,
})
