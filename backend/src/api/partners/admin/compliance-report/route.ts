import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { ComplianceLoggerService } from "../../../../services/compliance-logger.service"

const ComplianceReportQuerySchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  partner_id: z.string().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const validated = ComplianceReportQuerySchema.safeParse(req.query)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query",
      errors: validated.error.flatten(),
    })
    return
  }

  const report = await new ComplianceLoggerService(req.scope).generateComplianceReport({
    startDate: validated.data.start_date,
    endDate: validated.data.end_date,
    partnerId: validated.data.partner_id,
  })

  res.status(200).json({
    success: true,
    report,
  })
}
