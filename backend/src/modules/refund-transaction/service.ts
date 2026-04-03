import { MedusaService } from "@medusajs/framework/utils"
import RefundTransaction from "./models/refund-transaction"

class RefundTransactionModuleService extends MedusaService({
  RefundTransaction,
}) {}

export default RefundTransactionModuleService
