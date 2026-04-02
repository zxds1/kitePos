import crypto from "crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { PARTNER_MODULE } from "../../../../modules/partner"
import type PartnerModuleService from "../../../../modules/partner/service"
import { hashSecret } from "../../../../utils/hash"

const CreatePartnerSchema = z.object({
  name: z.string().min(3),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  company_registration: z.string().optional(),
  billing_tier: z.enum(["free", "basic", "premium", "enterprise"]),
  billing_email: z.string().email(),
  permissions: z.object({
    regions: z.array(z.string()).min(1),
    data_types: z.array(z.enum(["sales", "products", "stock", "payments"])).min(1),
  }),
  rate_limit: z.number().int().positive().max(10000).optional().default(100),
  quota_monthly: z.number().int().positive().max(1000000).optional().default(10000),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = CreatePartnerSchema.safeParse(req.body)

  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Invalid partner payload",
      errors: validated.error.flatten(),
    })
    return
  }

  const partnerService: PartnerModuleService = req.scope.resolve(PARTNER_MODULE)
  const apiKey = crypto.randomBytes(32).toString("hex")
  const apiKeyHash = hashSecret(apiKey, "partner_api_key")

  const [partner] = await partnerService.createPartners([
    {
      ...validated.data,
      api_key_hash: apiKeyHash,
      api_key_last4: apiKey.slice(-4),
      is_active: true,
      is_verified: true,
      approved_by: "medusa-admin",
    },
  ])

  res.status(201).json({
    success: true,
    partner: {
      id: partner.id,
      name: partner.name,
      contact_email: partner.contact_email,
      billing_tier: partner.billing_tier,
      permissions: partner.permissions,
      api_key_last4: partner.api_key_last4,
    },
    api_key: apiKey,
    message: "Partner created. Store this API key now; it will not be returned again.",
  })
}
