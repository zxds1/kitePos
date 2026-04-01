import { MedusaService } from "@medusajs/framework/utils"
import InventoryConfig from "./models/inventory-config"

class InventoryConfigModuleService extends MedusaService({
  InventoryConfig,
}) {}

export default InventoryConfigModuleService
