import { MedusaService } from "@medusajs/framework/utils"
import TaxInvoice from "./models/tax-invoice"

class TaxInvoiceModuleService extends MedusaService({
  TaxInvoice,
}) {}

export default TaxInvoiceModuleService
