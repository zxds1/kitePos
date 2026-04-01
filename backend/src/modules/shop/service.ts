import { MedusaService } from "@medusajs/framework/utils"
import Shop from "./models/shop"

class ShopModuleService extends MedusaService({
  Shop,
}) {}

export default ShopModuleService
