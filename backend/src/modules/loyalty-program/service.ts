import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyProgram from "./models/loyalty-program"

class LoyaltyProgramModuleService extends MedusaService({
  LoyaltyProgram,
}) {}

export default LoyaltyProgramModuleService
