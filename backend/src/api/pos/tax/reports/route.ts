import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { TAX_REPORT_RUN_MODULE } from "../../../../modules/tax-report-run"
import type TaxReportRunModuleService from "../../../../modules/tax-report-run/service"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { RETURN_REQUEST_MODULE } from "../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../modules/return-request/service"
import { listShopLocations } from "../../_utils/shop-locations"
import { TaxService } from "../../../../services/tax.service"

const ReportSchema = z.object({
  report_type: z.enum(["vat", "income", "paye"]).default("vat"),
  branch_scope: z.string().trim().optional().nullable(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
  vat_rate_percent: z.coerce.number().min(0).max(100).default(16),
})

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const locationId =
    typeof req.query.location_id === "string" && req.query.location_id.trim().length > 0
      ? req.query.location_id.trim()
      : null
  const runService: TaxReportRunModuleService = req.scope.resolve(TAX_REPORT_RUN_MODULE)
  const [runs] = await runService.listAndCountTaxReportRuns(
    { shop_id: auth.shop_id },
    { take: 25, order: { generated_at: "DESC" } }
  )
  const dashboard = await new TaxService(req.scope).getDashboard(auth.shop_id, locationId)

  res.status(200).json({
    success: true,
    settings: dashboard.settings,
    summary: dashboard.summary,
    invoices: dashboard.invoices,
    vat_returns: dashboard.vat_returns,
    input_vat_records: dashboard.input_vat_records,
    reports: (runs as Array<Record<string, unknown>>).map((run) => ({
      id: run.id,
      report_type: run.report_type,
      branch_scope: run.branch_scope ?? null,
      period_start: run.period_start ?? null,
      period_end: run.period_end ?? null,
      vat_rate_percent: Number(run.vat_rate_percent ?? 16),
      status: run.status ?? "completed",
      payload: run.payload ?? null,
      generated_at: run.generated_at ?? null,
    })),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = ReportSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid tax report payload", errors: parsed.error.flatten() })
    return
  }

  const [locations, snapshotsResult, returnsResult] = await Promise.all([
    listShopLocations(req.scope, auth.shop_id),
    req.scope.resolve<SaleSnapshotModuleService>(SALE_SNAPSHOT_MODULE).listAndCountSaleSnapshots(
      {
        shop_id: auth.shop_id,
        ...(parsed.data.branch_scope ? { location_id: parsed.data.branch_scope } : {}),
        timestamp: {
          $gte: parsed.data.period_start,
          $lte: parsed.data.period_end,
        },
      },
      { take: 10000, order: { timestamp: "ASC" } }
    ),
    req.scope.resolve<ReturnRequestModuleService>(RETURN_REQUEST_MODULE).listAndCountReturnRequests(
      {
        shop_id: auth.shop_id,
        requested_at: {
          $gte: parsed.data.period_start,
          $lte: parsed.data.period_end,
        },
      } as Record<string, unknown>,
      { take: 10000, order: { requested_at: "ASC" } }
    ),
  ])

  const snapshots = (snapshotsResult[0] as Array<Record<string, unknown>>) ?? []
  const returnRequests = (returnsResult[0] as Array<Record<string, unknown>>) ?? []
  const shop = await new TaxService(req.scope).getShop(auth.shop_id)
  const grossSales = snapshots.reduce(
    (sum, entry) => sum + asNumber(entry.amount_paid ?? entry.price_charged),
    0
  )
  const refundAmount = returnRequests
    .filter((entry) => String(entry.status ?? "pending") === "approved")
    .reduce((sum, entry) => sum + asNumber(entry.amount), 0)
  const netSales = Math.max(0, grossSales - refundAmount)
  const taxableBase = parsed.data.report_type === "vat" ? netSales : grossSales
  const vatRate = parsed.data.vat_rate_percent / 100
  const turnoverTaxAmount = Number((grossSales * 0.03).toFixed(2))
  const taxAmount = Number(((shop?.tax_type === "turnover_tax" ? grossSales * 0.03 : taxableBase * vatRate)).toFixed(2))
  const locationName = locations.find((entry) => entry.id === parsed.data.branch_scope)?.name ?? null
  const etimsSignals = {
    invoice_stream_ready: snapshots.length > 0,
    branch_control_unit: parsed.data.branch_scope ?? "all_branches",
    receipt_reference_coverage_percent:
      snapshots.length === 0
        ? 0
        : Number(
            (
              (snapshots.filter((entry) => String(entry.client_transaction_id ?? "").trim().length > 0)
                .length /
                snapshots.length) *
              100
            ).toFixed(1)
          ),
    tax_rate_percent: parsed.data.vat_rate_percent,
    compliance_note:
      "Generated as an eTIMS-ready summary. Final invoice issuance and KRA submission remain subject to your connected fiscal workflow.",
  }

  const payload = {
    report_type: parsed.data.report_type,
    branch_scope: parsed.data.branch_scope ?? null,
    branch_name: locationName,
    period_start: parsed.data.period_start.toISOString(),
    period_end: parsed.data.period_end.toISOString(),
    gross_sales: Number(grossSales.toFixed(2)),
    approved_refunds: Number(refundAmount.toFixed(2)),
    net_sales: Number(netSales.toFixed(2)),
    taxable_sales: Number(taxableBase.toFixed(2)),
    tax_due: taxAmount,
    turnover_tax_due: turnoverTaxAmount,
    tax_type: shop?.tax_type ?? "exempt",
    total_transactions: snapshots.length,
    approved_return_count: returnRequests.filter((entry) => String(entry.status ?? "pending") === "approved").length,
    etims: etimsSignals,
  }

  const runService: TaxReportRunModuleService = req.scope.resolve(TAX_REPORT_RUN_MODULE)
  const created = await runService.createTaxReportRuns({
    id: `tax_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    report_type: parsed.data.report_type,
    branch_scope: parsed.data.branch_scope ?? null,
    period_start: parsed.data.period_start,
    period_end: parsed.data.period_end,
    vat_rate_percent: parsed.data.vat_rate_percent,
    status: "completed",
    payload,
    generated_by: auth.user_id ?? null,
    generated_at: new Date(),
  } as Record<string, unknown>)
  const createdRun = created as Record<string, unknown>

  res.status(201).json({
    success: true,
    report: {
      id: createdRun.id,
      report_type: createdRun.report_type,
      branch_scope: createdRun.branch_scope ?? null,
      period_start: createdRun.period_start ?? null,
      period_end: createdRun.period_end ?? null,
      vat_rate_percent: Number(createdRun.vat_rate_percent ?? parsed.data.vat_rate_percent),
      status: createdRun.status ?? "completed",
      payload,
      generated_at: createdRun.generated_at ?? null,
    },
  })
}
