import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { AnalyticsQuerySchema, buildProductAnalyticsDetail } from "../../_shared"
import { canUseLocation } from "../../../../auth/_utils/shop-users"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const variantId = req.params.id
  if (!variantId) {
    res.status(400).json({
      success: false,
      message: "Variant id is required",
    })
    return
  }

  const parsed = AnalyticsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: parsed.error.flatten(),
    })
    return
  }

  if (parsed.data.location_id && !canUseLocation(auth, parsed.data.location_id)) {
    res.status(403).json({
      success: false,
      message: "Location analytics access denied",
    })
    return
  }

  const detail = await buildProductAnalyticsDetail(
    req,
    auth.shop_id,
    variantId,
    parsed.data.start_date,
    parsed.data.end_date,
    {
      locationId: parsed.data.location_id ?? null,
      salesChannel: parsed.data.sales_channel,
    }
  )

  if (!detail) {
    res.status(404).json({
      success: false,
      message: "Product analytics not found",
    })
    return
  }

  res.status(200).json({
    success: true,
    data: detail,
  })
}
