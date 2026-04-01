import { MedusaService } from "@medusajs/framework/utils"
import Adjustment from "./models/adjustment"

class AdjustmentModuleService extends MedusaService({
  Adjustment,
}) {}

export default AdjustmentModuleService
