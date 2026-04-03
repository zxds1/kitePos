import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toCatalogPayload } from "../../../utils/catalog-config"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.status(200).json({
    success: true,
    catalog: toCatalogPayload(),
  })
}
