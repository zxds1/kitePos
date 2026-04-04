import { MedusaService } from "@medusajs/framework/utils"
import AiOperationLog from "./models/ai-operation-log"

class AIOperationLogModuleService extends MedusaService({
  AiOperationLog,
}) {}

export default AIOperationLogModuleService
