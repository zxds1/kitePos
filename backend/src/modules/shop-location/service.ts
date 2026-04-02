import { MedusaService } from "@medusajs/framework/utils"
import ShopLocation from "./models/shop-location"

class ShopLocationModuleService extends MedusaService({
  ShopLocation,
}) {}

export default ShopLocationModuleService
