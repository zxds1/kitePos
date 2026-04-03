import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { TaxService } from "../../../services/tax.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const locationId =
    typeof req.query.location_id === "string" && req.query.location_id.trim().length > 0
      ? req.query.location_id.trim()
      : null
  const tax = new TaxService(req.scope)
  const dashboard = await tax.getDashboard(auth.shop_id, locationId)
  res.status(200).json({
    success: true,
    ...dashboard,
  })
}
