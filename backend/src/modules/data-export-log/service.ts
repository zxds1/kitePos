import { MedusaService } from "@medusajs/framework/utils"
import DataExportLog from "./models/data-export-log"

class DataExportLogModuleService extends MedusaService({
  DataExportLog,
}) {}

export default DataExportLogModuleService
