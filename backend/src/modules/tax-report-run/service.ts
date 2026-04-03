import { MedusaService } from "@medusajs/framework/utils"
import TaxReportRun from "./models/tax-report-run"

class TaxReportRunModuleService extends MedusaService({
  TaxReportRun,
}) {}

export default TaxReportRunModuleService
