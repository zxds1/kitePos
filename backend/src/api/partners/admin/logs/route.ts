import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { DATA_EXPORT_LOG_MODULE } from "../../../../modules/data-export-log"
import type DataExportLogModuleService from "../../../../modules/data-export-log/service"

const LogQuerySchema = z.object({
  partner_id: z.string().optional(),
  status: z.enum(["pending", "completed", "failed", "rejected"]).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const validated = LogQuerySchema.safeParse(req.query)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query",
      errors: validated.error.flatten(),
    })
    return
  }

  const dataExportLogService: DataExportLogModuleService = req.scope.resolve(
    DATA_EXPORT_LOG_MODULE
  )

  const filters: Record<string, unknown> = {}
  if (validated.data.partner_id) {
    filters.partner_id = validated.data.partner_id
  }
  if (validated.data.status) {
    filters.status = validated.data.status
  }
  if (validated.data.start_date || validated.data.end_date) {
    filters.requested_at = {
      ...(validated.data.start_date ? { $gte: validated.data.start_date } : {}),
      ...(validated.data.end_date ? { $lte: validated.data.end_date } : {}),
    }
  }

  const logs = await dataExportLogService.listDataExportLogs(filters, {
    take: 1000,
    order: { requested_at: "DESC" },
  })

  res.status(200).json({
    success: true,
    logs,
  })
}
