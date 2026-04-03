import type { MedusaContainer } from "@medusajs/framework/types"
import { AutoReorderService } from "../services/auto-reorder.service"

export default async function autoReorderCheck(container: MedusaContainer) {
  const service = new AutoReorderService(container)
  await service.checkAndTriggerReorders()
}

export const config = {
  name: "auto-reorder-check",
  schedule: "*/15 * * * *",
}
