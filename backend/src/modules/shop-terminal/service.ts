import { MedusaService } from "@medusajs/framework/utils"
import ShopTerminal from "./models/shop-terminal"

class ShopTerminalModuleService extends MedusaService({
  ShopTerminal,
}) {}

export default ShopTerminalModuleService
