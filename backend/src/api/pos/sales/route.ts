import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { POST as adminBatchSales } from "../../admin/inventory/batch-sales/route"
import { AdminBatchSalesRequest } from "../../admin/inventory/batch-sales/validator"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const body = (req.body as Record<string, unknown> | undefined) ?? {}
  const parsed = AdminBatchSalesRequest.safeParse({
    ...body,
    shop_id: auth.shop_id,
  })

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  ;(req as MedusaRequest & { validatedBody?: unknown }).validatedBody = parsed.data
  await adminBatchSales(req, res)
}
