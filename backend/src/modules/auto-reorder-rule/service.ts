import { MedusaService } from "@medusajs/framework/utils"
import AutoReorderRule from "./models/auto-reorder-rule"

class AutoReorderRuleModuleService extends MedusaService({
  AutoReorderRule,
}) {}

export default AutoReorderRuleModuleService
