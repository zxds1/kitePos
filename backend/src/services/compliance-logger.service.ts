import type { MedusaContainer } from "@medusajs/framework/types"
import { DATA_EXPORT_LOG_MODULE } from "../modules/data-export-log"
import type DataExportLogModuleService from "../modules/data-export-log/service"

type DataAccessLogInput = {
  partnerId: string
  action: string
  dataType: string
  queryParams: Record<string, unknown>
  resultRowCount: number
  format: "csv" | "json" | "api"
  ipAddress?: string
  userAgent?: string
  consentVerified: boolean
  aggregationThresholdMet: boolean
  quotaUsed: number
  billingAmount?: number
  status?: "pending" | "completed" | "failed" | "rejected"
  errorMessage?: string | null
}

export class ComplianceLoggerService {
  constructor(private container: MedusaContainer) {}

  private get dataExportLogService(): DataExportLogModuleService {
    return this.container.resolve(DATA_EXPORT_LOG_MODULE)
  }

  async logDataAccess(input: DataAccessLogInput) {
    const expiresAt = new Date()
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 90)

    const [log] = await this.dataExportLogService.createDataExportLogs([
      {
        partner_id: input.partnerId,
        query_params: {
          ...input.queryParams,
          action: input.action,
        },
        result_row_count: input.resultRowCount,
        format: input.format,
        data_type: input.dataType,
        consent_verified: input.consentVerified,
        min_aggregation_threshold: 10,
        pii_filtered: true,
        aggregation_threshold_met: input.aggregationThresholdMet,
        quota_used: input.quotaUsed,
        billing_amount: input.billingAmount ?? 0,
        requested_at: new Date(),
        completed_at: input.status === "completed" ? new Date() : null,
        expires_at: expiresAt,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        status: input.status ?? "completed",
        error_message: input.errorMessage ?? null,
      },
    ])

    return log
  }

  async generateComplianceReport({
    startDate,
    endDate,
    partnerId,
  }: {
    startDate: Date
    endDate: Date
    partnerId?: string
  }) {
    const logs = await this.dataExportLogService.listDataExportLogs(
      {
        requested_at: {
          $gte: startDate,
          $lte: endDate,
        },
        status: "completed",
        ...(partnerId ? { partner_id: partnerId } : {}),
      },
      {
        take: 10000,
        order: { requested_at: "DESC" },
      }
    )

    const totalExports = logs.length
    const totalRowsExported = logs.reduce(
      (sum, log) => sum + Number(log.result_row_count ?? 0),
      0
    )
    const consentVerifiedCount = logs.filter((log) => log.consent_verified === true).length
    const thresholdMetCount = logs.filter(
      (log) => log.aggregation_threshold_met === true
    ).length

    return {
      report_period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      total_exports: totalExports,
      total_rows_exported: totalRowsExported,
      partners_accessed: [...new Set(logs.map((log) => log.partner_id))],
      consent_compliance_rate:
        totalExports > 0 ? (consentVerifiedCount / totalExports) * 100 : 100,
      aggregation_compliance_rate:
        totalExports > 0 ? (thresholdMetCount / totalExports) * 100 : 100,
    }
  }
}
