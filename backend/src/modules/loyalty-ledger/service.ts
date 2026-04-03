import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyLedger from "./models/loyalty-ledger"

class LoyaltyLedgerModuleService extends MedusaService({
  LoyaltyLedger,
}) {}

export default LoyaltyLedgerModuleService
