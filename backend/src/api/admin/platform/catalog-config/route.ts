import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  getCatalogConfigPath,
  parseCatalogConfig,
  saveCatalogConfig,
  toCatalogPayload,
} from "../../../../utils/catalog-config"

const UpdateCatalogConfigSchema = z.object({
  catalog: z.record(z.string(), z.unknown()),
})

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.status(200).json({
    success: true,
    path: getCatalogConfigPath(),
    catalog: toCatalogPayload(),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const parsed = UpdateCatalogConfigSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid catalog config payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  try {
    parseCatalogConfig(parsed.data.catalog)
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Catalog config is invalid",
    })
    return
  }

  const saved = saveCatalogConfig(parsed.data.catalog)

  res.status(200).json({
    success: true,
    message: "Catalog config updated",
    path: getCatalogConfigPath(),
    catalog: toCatalogPayload(saved),
  })
}
