import { MedusaService } from "@medusajs/framework/utils"
import ShopUser from "./models/shop-user"

class ShopUserModuleService extends MedusaService({
  ShopUser,
}) {}

export default ShopUserModuleService
