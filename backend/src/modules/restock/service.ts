import { MedusaService } from "@medusajs/framework/utils"
import Restock from "./models/restock"

class RestockModuleService extends MedusaService({
  Restock,
}) {}

export default RestockModuleService
