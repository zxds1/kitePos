import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyReward from "./models/loyalty-reward"

class LoyaltyRewardModuleService extends MedusaService({
  LoyaltyReward,
}) {}

export default LoyaltyRewardModuleService
