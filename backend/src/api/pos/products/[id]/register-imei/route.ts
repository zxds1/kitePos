import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { INVENTORY_CONFIG_MODULE } from "../../../../../modules/inventory-config"
import type InventoryConfigModuleService from "../../../../../modules/inventory-config/service"
import {
  getInventoryConfigByVariantId,
  resolveShopId,
} from "../../../../admin/products/_utils"

const RegisterImeiSchema = z.object({
  imei: z.string().regex(/^\d{15}$/, "IMEI must be 15 digits"),
  serial_number: z.string().trim().optional().nullable(),
  warranty_months: z.coerce.number().int().min(0).optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const parsed = RegisterImeiSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid IMEI data",
      errors: parsed.error.flatten(),
    })
    return
  }

  const shopId = resolveShopId(req as PosAuthenticatedRequest)
  if (!shopId) {
    res.status(400).json({ success: false, message: "shop_id is required" })
    return
  }

  const inventoryConfigService: InventoryConfigModuleService = req.scope.resolve(
    INVENTORY_CONFIG_MODULE
  )
  const [existing] = await inventoryConfigService.listInventoryConfigs(
    { imei: parsed.data.imei },
    { take: 1 }
  )
  if (existing) {
    res.status(409).json({
      success: false,
      message: "This IMEI is already registered",
    })
    return
  }

  const inventoryConfig = await getInventoryConfigByVariantId(
    req,
    req.params.id,
    shopId
  )
  if (!inventoryConfig?.id) {
    res.status(404).json({ success: false, message: "Product not found" })
    return
  }

  await inventoryConfigService.updateInventoryConfigs([
    {
      id: inventoryConfig.id,
      imei: parsed.data.imei,
      serial_number: parsed.data.serial_number ?? null,
      warranty_enabled: parsed.data.warranty_months != null,
      warranty_months: parsed.data.warranty_months ?? null,
    },
  ] as unknown as Record<string, unknown>[])

  res.status(200).json({
    success: true,
    imei: parsed.data.imei,
    warranty_months: parsed.data.warranty_months ?? null,
    message: "IMEI registered successfully",
  })
}
