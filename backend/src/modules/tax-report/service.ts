import { MedusaService } from "@medusajs/framework/utils"
import TaxReport from "./models/tax-report"

class TaxReportModuleService extends MedusaService({
  TaxReport,
}) {}

export default TaxReportModuleService
