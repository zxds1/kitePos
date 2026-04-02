import { MedusaService } from "@medusajs/framework/utils"
import AnalyticsSnapshot from "./models/analytics-snapshot"

class AnalyticsSnapshotModuleService extends MedusaService({
  AnalyticsSnapshot,
}) {}

export default AnalyticsSnapshotModuleService
