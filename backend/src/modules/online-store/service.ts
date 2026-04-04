import { MedusaService } from "@medusajs/framework/utils"
import OnlineStore from "./models/online-store"

class OnlineStoreModuleService extends MedusaService({
  OnlineStore,
}) {}

export default OnlineStoreModuleService
