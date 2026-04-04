import { MedusaService } from "@medusajs/framework/utils"
import AiConfig from "./models/ai-config"

class AIConfigModuleService extends MedusaService({
  AiConfig,
}) {}

export default AIConfigModuleService
