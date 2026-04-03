import { MedusaService } from "@medusajs/framework/utils"
import VatReturn from "./models/vat-return"

class VatReturnModuleService extends MedusaService({
  VatReturn,
}) {}

export default VatReturnModuleService
