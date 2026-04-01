import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INVENTORY_CONFIG_MODULE } from "../../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../../modules/inventory-config/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )

  const { variant_id } = req.params

  const [inventory_config] = await service.listInventoryConfigs(
    { variant_id },
    {
      take: 1,
      order: {
        created_at: "DESC",
      },
    }
  )

  if (!inventory_config) {
    res.status(404).json({
      message: `Inventory config for variant ${variant_id} was not found`,
    })
    return
  }

  res.json({ inventory_config })
}
