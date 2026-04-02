import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PARTNER_MODULE } from "../../../../modules/partner"
import type PartnerModuleService from "../../../../modules/partner/service"
import { DATA_EXPORT_LOG_MODULE } from "../../../../modules/data-export-log"
import type DataExportLogModuleService from "../../../../modules/data-export-log/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const partnerService: PartnerModuleService = req.scope.resolve(PARTNER_MODULE)
  const dataExportLogService: DataExportLogModuleService = req.scope.resolve(
    DATA_EXPORT_LOG_MODULE
  )
  const partners = await partnerService.listPartners({}, {
    take: 1000,
    order: { created_at: "DESC" },
  })

  const withUsage = await Promise.all(
    partners.map(async (partner) => {
      const quota_used = await partnerService.getQuotaUsed(partner.id, dataExportLogService)
      return {
        id: partner.id,
        name: partner.name,
        contact_email: partner.contact_email,
        billing_tier: partner.billing_tier,
        permissions: partner.permissions,
        rate_limit: partner.rate_limit,
        quota_monthly: partner.quota_monthly,
        quota_used,
        quota_remaining: Math.max(0, Number(partner.quota_monthly ?? 0) - quota_used),
        is_active: partner.is_active,
        is_verified: partner.is_verified,
        last_accessed_at: partner.last_accessed_at,
        api_key_last4: partner.api_key_last4,
      }
    })
  )

  res.status(200).json({
    success: true,
    partners: withUsage,
  })
}
