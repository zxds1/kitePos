import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePartnerRequest } from "../_utils/auth"
import type { PartnerRecord } from "../../../modules/partner/service"

function shapePartnerResponse(input: {
  partner: PartnerRecord
  quotaRemaining: number
}) {
  return {
    success: true,
    partner: {
      id: input.partner.id,
      name: input.partner.name,
      billing_tier: input.partner.billing_tier,
      permissions: input.partner.permissions ?? {},
      rate_limit: input.partner.rate_limit ?? 100,
      quota_monthly: input.partner.quota_monthly ?? 10000,
      quota_used: Math.max(
        0,
        Number(input.partner.quota_monthly ?? 10000) - input.quotaRemaining
      ),
      quota_remaining: input.quotaRemaining,
      is_verified: input.partner.is_verified ?? false,
      api_key_last4: input.partner.api_key_last4 ?? null,
    },
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = await authenticatePartnerRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json(auth.body)
    return
  }

  res.status(200).json(shapePartnerResponse(auth))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return GET(req, res)
}
