import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyRedemption from "./models/loyalty-redemption"

class LoyaltyRedemptionModuleService extends MedusaService({
  LoyaltyRedemption,
}) {}

export default LoyaltyRedemptionModuleService
