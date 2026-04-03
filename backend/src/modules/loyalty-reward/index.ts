import { Module } from "@medusajs/framework/utils"
import LoyaltyRewardModuleService from "./service"

export const LOYALTY_REWARD_MODULE = "loyalty_reward"

export default Module(LOYALTY_REWARD_MODULE, {
  service: LoyaltyRewardModuleService,
})
