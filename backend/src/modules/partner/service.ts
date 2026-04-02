import { MedusaService } from "@medusajs/framework/utils"
import Partner from "./models/partner"
import { hashSecret } from "../../utils/hash"
import { DATA_EXPORT_LOG_MODULE } from "../data-export-log"
import type DataExportLogModuleService from "../data-export-log/service"

type PartnerRecord = {
  id: string
  name: string
  api_key_hash: string
  api_key_last4?: string | null
  is_active?: boolean
  is_verified?: boolean
  billing_tier: string
  rate_limit?: number | null
  quota_monthly: number
  last_accessed_at?: Date | null
  permissions?: {
    regions?: string[]
    data_types?: string[]
  } | null
}

export type { PartnerRecord }

class PartnerModuleService extends MedusaService({
  Partner,
}) {
  async verifyApiKey(apiKey: string) {
    const [partners] = await this.listAndCountPartners(
      {
        api_key_hash: hashSecret(apiKey, "partner_api_key"),
        is_active: true,
      },
      { take: 1 }
    )

    return (partners[0] as PartnerRecord | undefined) ?? null
  }

  async getQuotaUsed(
    partnerId: string,
    dataExportLogService: DataExportLogModuleService
  ) {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const logs = await dataExportLogService.listDataExportLogs({
      partner_id: partnerId,
      status: "completed",
      requested_at: {
        $gte: startOfMonth,
      },
    })

    return logs.reduce((sum, log) => sum + Number(log.quota_used ?? 0), 0)
  }

  async getQuotaRemaining(
    partnerId: string,
    dataExportLogService: DataExportLogModuleService
  ) {
    const [partners] = await this.listAndCountPartners({ id: partnerId }, { take: 1 })
    const partner = partners[0] as PartnerRecord | undefined

    if (!partner) {
      return 0
    }

    const used = await this.getQuotaUsed(partnerId, dataExportLogService)
    return Math.max(0, Number(partner.quota_monthly ?? 0) - used)
  }

  async touchLastAccessed(partnerId: string) {
    const [partner] = await this.updatePartners([
      {
        id: partnerId,
        last_accessed_at: new Date(),
      },
    ])

    return partner
  }

  async enforcePermission(
    partner: PartnerRecord,
    dataType: string,
    regions?: string[]
  ) {
    const allowedDataTypes = partner.permissions?.data_types ?? []
    if (!allowedDataTypes.includes(dataType)) {
      throw new Error("forbidden_data_type")
    }

    const allowedRegions = partner.permissions?.regions ?? []
    if (regions && regions.length > 0) {
      const unauthorized = regions.find((region) => !allowedRegions.includes(region))
      if (unauthorized) {
        throw new Error("forbidden_region")
      }
    }
  }
}

export default PartnerModuleService
