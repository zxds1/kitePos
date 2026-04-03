import { MedusaService } from "@medusajs/framework/utils"
import ReturnReason from "./models/return-reason"

class ReturnReasonModuleService extends MedusaService({
  ReturnReason,
}) {}

export default ReturnReasonModuleService
