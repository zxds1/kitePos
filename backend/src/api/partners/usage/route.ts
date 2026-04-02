import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePartnerRequest } from "../_utils/auth"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = await authenticatePartnerRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json(auth.body)
    return
  }

  const logs = await auth.dataExportLogService.listDataExportLogs(
    { partner_id: auth.partner.id },
    {
      take: 20,
      order: { requested_at: "DESC" },
    }
  )

  res.status(200).json({
    success: true,
    usage: {
      quota_monthly: auth.partner.quota_monthly ?? 10000,
      quota_remaining: auth.quotaRemaining,
      quota_used: Math.max(
        0,
        Number(auth.partner.quota_monthly ?? 10000) - auth.quotaRemaining
      ),
      billing_tier: auth.partner.billing_tier,
      recent_exports: logs.map((log) => ({
        id: log.id,
        data_type: log.data_type,
        result_row_count: log.result_row_count,
        requested_at: log.requested_at,
        status: log.status,
        format: log.format,
      })),
    },
  })
}
