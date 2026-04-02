import type { MedusaRequest } from "@medusajs/framework/http"
import { PARTNER_MODULE } from "../../../modules/partner"
import type PartnerModuleService from "../../../modules/partner/service"
import { DATA_EXPORT_LOG_MODULE } from "../../../modules/data-export-log"
import type DataExportLogModuleService from "../../../modules/data-export-log/service"

type RateLimitEntry = {
  count: number
  resetAt: number
}

const partnerRateLimits = new Map<string, RateLimitEntry>()

function getPartnerApiKey(req: MedusaRequest) {
  const header = req.headers["x-partner-api-key"]
  return Array.isArray(header) ? header[0] : header
}

export async function authenticatePartnerRequest(req: MedusaRequest) {
  const apiKey = getPartnerApiKey(req)

  if (!apiKey || typeof apiKey !== "string") {
    return {
      ok: false as const,
      status: 401,
      body: {
        success: false,
        message: "Partner API key required",
      },
    }
  }

  const partnerService: PartnerModuleService = req.scope.resolve(PARTNER_MODULE)
  const dataExportLogService: DataExportLogModuleService = req.scope.resolve(
    DATA_EXPORT_LOG_MODULE
  )

  const partner = await partnerService.verifyApiKey(apiKey)

  if (!partner || partner.is_active !== true) {
    return {
      ok: false as const,
      status: 401,
      body: {
        success: false,
        message: "Invalid or inactive API key",
      },
    }
  }

  const now = Date.now()
  const current = partnerRateLimits.get(partner.id)
  if (!current || current.resetAt <= now) {
    partnerRateLimits.set(partner.id, {
      count: 1,
      resetAt: now + 60 * 60 * 1000,
    })
  } else if (current.count >= Number(partner.rate_limit ?? 100)) {
    return {
      ok: false as const,
      status: 429,
      body: {
        success: false,
        message: "Partner hourly rate limit exceeded",
        retry_after_seconds: Math.ceil((current.resetAt - now) / 1000),
      },
    }
  } else {
    current.count += 1
    partnerRateLimits.set(partner.id, current)
  }

  const quotaRemaining = await partnerService.getQuotaRemaining(
    partner.id,
    dataExportLogService
  )
  await partnerService.touchLastAccessed(partner.id)

  return {
    ok: true as const,
    partner,
    quotaRemaining,
    partnerService,
    dataExportLogService,
  }
}

export function getRequestMetadata(req: MedusaRequest) {
  const forwardedFor = req.headers["x-forwarded-for"]
  const ipAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const userAgent = req.headers["user-agent"]

  return {
    ipAddress: typeof ipAddress === "string" ? ipAddress : req.ip ?? undefined,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  }
}
