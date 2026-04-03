import { MedusaService } from "@medusajs/framework/utils"
import ShiftSession from "./models/shift-session"

class ShiftSessionModuleService extends MedusaService({
  ShiftSession,
}) {}

export default ShiftSessionModuleService
