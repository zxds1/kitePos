import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../../auth/_utils/jwt"
import { TaxService } from "../../../../../../services/tax.service"

const GenerateVatReturnSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  location_id: z.string().trim().optional().nullable(),
  include_draft: z.boolean().optional().default(false),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = GenerateVatReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid VAT return request", errors: parsed.error.flatten() })
    return
  }

  const tax = new TaxService(req.scope)
  const vatReturn = await tax.generateVatReturn({
    shopId: auth.shop_id,
    period: parsed.data.period,
    locationId: parsed.data.location_id ?? null,
    includeDraft: parsed.data.include_draft,
    createdBy: auth.user_id ?? auth.shop_id,
  })

  res.status(201).json({
    success: true,
    vat_return: tax.shapeVatReturn(vatReturn as Record<string, unknown>),
  })
}
