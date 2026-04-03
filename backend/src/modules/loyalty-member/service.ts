import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyMember from "./models/loyalty-member"

class LoyaltyMemberModuleService extends MedusaService({
  LoyaltyMember,
}) {}

export default LoyaltyMemberModuleService
