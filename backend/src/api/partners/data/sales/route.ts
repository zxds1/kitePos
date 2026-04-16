import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { DataAggregationService } from "../../../../services/data-aggregation.service"
import { ComplianceLoggerService } from "../../../../services/compliance-logger.service"
import { authenticatePartnerRequest, getRequestMetadata } from "../../_utils/auth"
import { billPartnerExport } from "../../_utils/billing"

const SalesQuerySchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  regions: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      typeof value === "string"
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : value
    ),
  group_by: z.enum(["region", "ward", "category"]).optional().default("region"),
  format: z.enum(["json", "csv"]).optional().default("json"),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = await authenticatePartnerRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json(auth.body)
    return
  }

  const validated = SalesQuerySchema.safeParse(req.query)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query params",
      errors: validated.error.flatten(),
    })
    return
  }

  const { regions = [], group_by, format, start_date, end_date } = validated.data

  try {
    await auth.partnerService.enforcePermission(auth.partner, "sales", regions)
  } catch (error) {
    res.status(403).json({
      success: false,
      message: error instanceof Error && error.message === "forbidden_region"
        ? "Partner is not authorized for one or more requested regions"
        : "Partner is not authorized for sales data",
    })
    return
  }

  const result = await new DataAggregationService(req.scope, req).getAggregatedSales({
    partnerId: auth.partner.id,
    regions,
    startDate: start_date,
    endDate: end_date,
    groupBy: group_by,
    minShops: 10,
    ...getRequestMetadata(req),
  })

  const requestMetadata = getRequestMetadata(req)

  if (auth.quotaRemaining <= 0 || result.data.length > auth.quotaRemaining) {
    await new ComplianceLoggerService(req.scope).logDataAccess({
      partnerId: auth.partner.id,
      action: "export",
      dataType: "sales",
      queryParams: {
        regions,
        start_date: start_date.toISOString(),
        end_date: end_date.toISOString(),
        group_by,
      },
      resultRowCount: result.data.length,
      format,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      consentVerified: true,
      aggregationThresholdMet: true,
      quotaUsed: 0,
      status: "rejected",
      errorMessage: "Monthly quota exceeded",
    })
    res.status(429).json({
      success: false,
      message: "Monthly quota exceeded",
      quota_reset_date: new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
      ).toISOString(),
    })
    return
  }

  let billing
  try {
    billing = await billPartnerExport({
      partner: auth.partner,
      rowsExported: result.data.length,
      dataType: "sales",
      format,
    })
  } catch (error) {
    res.status(502).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to bill partner export",
    })
    return
  }

  if (format === "csv") {
    await new ComplianceLoggerService(req.scope).logDataAccess({
      partnerId: auth.partner.id,
      action: "export",
      dataType: "sales",
      queryParams: {
        regions,
        start_date: start_date.toISOString(),
        end_date: end_date.toISOString(),
        group_by,
      },
      resultRowCount: result.data.length,
      format,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      consentVerified: true,
      aggregationThresholdMet: true,
      quotaUsed: result.data.length,
      billingAmount: billing.amount,
    })
    const csv = new DataAggregationService(req.scope, req).toCsv(result.data, [
      "key",
      "total_revenue",
      "total_transactions",
      "shop_count",
      "average_transaction_value",
    ])
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=partner-sales-${Date.now()}.csv`
    )
    res.status(200).send(csv)
    return
  }

  await new ComplianceLoggerService(req.scope).logDataAccess({
    partnerId: auth.partner.id,
    action: "export",
    dataType: "sales",
    queryParams: {
      regions,
      start_date: start_date.toISOString(),
      end_date: end_date.toISOString(),
      group_by,
    },
    resultRowCount: result.data.length,
    format,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    consentVerified: true,
    aggregationThresholdMet: true,
    quotaUsed: result.data.length,
    billingAmount: billing.amount,
  })
  res.status(200).json({
    ...result,
    billing,
  })
}
