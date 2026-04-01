import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_CONFIG_MODULE } from "../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../modules/inventory-config/service"
import { AdminListInventoryConfigs } from "./validators"
import {
  buildCursorPage,
  decodeCursor,
  parseLimit,
} from "../_utils/pagination"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )

  const query = AdminListInventoryConfigs.parse(req.query)

  const limit = parseLimit(query.limit)
  const skip = decodeCursor(query.cursor)
  const filters: Record<string, unknown> = {}

  if (query.variant_id) {
    filters.variant_id = query.variant_id
  }

  if (query.inventory_type) {
    filters.inventory_type = query.inventory_type
  }

  if (typeof query.is_active === "boolean") {
    filters.is_active = query.is_active
  }

  const [inventory_configs, count] = await service.listAndCountInventoryConfigs(
    filters,
    {
      take: limit,
      skip,
      order: {
        created_at: "DESC",
      },
    }
  )

  res.json({
    inventory_configs,
    ...buildCursorPage(count, limit, skip),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )

  const inventory_config = await service.createInventoryConfigs(
    req.validatedBody as Record<string, unknown>
  )

  res.status(200).json({ inventory_config })
}
