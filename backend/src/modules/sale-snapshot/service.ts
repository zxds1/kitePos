import { MedusaService } from "@medusajs/framework/utils"
import SaleSnapshot from "./models/sale-snapshot"

class SaleSnapshotModuleService extends MedusaService({
  SaleSnapshot,
}) {}

export default SaleSnapshotModuleService
