import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { DataAggregationService } from "../../../../services/data-aggregation.service"
import { ComplianceLoggerService } from "../../../../services/compliance-logger.service"
import { authenticatePartnerRequest, getRequestMetadata } from "../../_utils/auth"
import { billPartnerExport } from "../../_utils/billing"

const ProductQuerySchema = z.object({
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
  category: z.string().optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = await authenticatePartnerRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json(auth.body)
    return
  }

  const validated = ProductQuerySchema.safeParse(req.query)
  if (!validated.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query params",
      errors: validated.error.flatten(),
    })
    return
  }

  const regions = validated.data.regions ?? []

  try {
    await auth.partnerService.enforcePermission(auth.partner, "products", regions)
  } catch (error) {
    res.status(403).json({
      success: false,
      message: "Partner is not authorized for this product benchmark request",
    })
    return
  }

  const result = await new DataAggregationService(req.scope, req).getProductBenchmarks({
    partnerId: auth.partner.id,
    startDate: validated.data.start_date,
    endDate: validated.data.end_date,
    regions,
    category: validated.data.category,
    minShops: 10,
    ...getRequestMetadata(req),
  })

  const requestMetadata = getRequestMetadata(req)

  if (auth.quotaRemaining <= 0 || result.data.length > auth.quotaRemaining) {
    await new ComplianceLoggerService(req.scope).logDataAccess({
      partnerId: auth.partner.id,
      action: "query",
      dataType: "products",
      queryParams: {
        regions,
        start_date: validated.data.start_date.toISOString(),
        end_date: validated.data.end_date.toISOString(),
        category: validated.data.category ?? null,
      },
      resultRowCount: result.data.length,
      format: "json",
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
    })
    return
  }

  let billing
  try {
    billing = await billPartnerExport({
      partner: auth.partner,
      rowsExported: result.data.length,
      dataType: "products",
      format: "json",
    })
  } catch (error) {
    res.status(502).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Unable to bill partner export",
    })
    return
  }

  await new ComplianceLoggerService(req.scope).logDataAccess({
    partnerId: auth.partner.id,
    action: "query",
    dataType: "products",
    queryParams: {
      regions,
      start_date: validated.data.start_date.toISOString(),
      end_date: validated.data.end_date.toISOString(),
      category: validated.data.category ?? null,
    },
    resultRowCount: result.data.length,
    format: "json",
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
