import { MedusaService } from "@medusajs/framework/utils"
import InputVatRecord from "./models/input-vat-record"

class InputVatRecordModuleService extends MedusaService({
  InputVatRecord,
}) {}

export default InputVatRecordModuleService
