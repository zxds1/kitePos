import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { SHIFT_SESSION_MODULE } from "../../../../../modules/shift-session"
import type ShiftSessionModuleService from "../../../../../modules/shift-session/service"
import { SALE_SNAPSHOT_MODULE } from "../../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../../modules/sale-snapshot/service"

const CloseShiftSchema = z.object({
  counted_cash: z.coerce.number().min(0),
  manager_note: z.string().trim().optional().nullable(),
})

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function shapeShift(shift: Record<string, unknown>) {
  return {
    id: String(shift.id),
    location_id: shift.location_id ?? null,
    terminal_id: shift.terminal_id ?? null,
    staff_user_id: shift.staff_user_id ?? null,
    opening_cash: Number(shift.opening_cash ?? 0),
    expected_cash: Number(shift.expected_cash ?? 0),
    counted_cash:
      shift.counted_cash == null ? null : Number(shift.counted_cash),
    digital_total: Number(shift.digital_total ?? 0),
    cash_sales_total: Number(shift.cash_sales_total ?? 0),
    total_transactions: Number(shift.total_transactions ?? 0),
    status: String(shift.status ?? "active"),
    manager_note: shift.manager_note ?? null,
    opened_at: shift.opened_at ?? null,
    closed_at: shift.closed_at ?? null,
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = CloseShiftSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid shift close payload", errors: parsed.error.flatten() })
    return
  }

  const shiftService: ShiftSessionModuleService = req.scope.resolve(SHIFT_SESSION_MODULE)
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(SALE_SNAPSHOT_MODULE)
  const [shifts] = await shiftService.listAndCountShiftSessions(
    { id: req.params.id, shop_id: auth.shop_id },
    { take: 1 }
  )
  const shift = shifts[0] as Record<string, unknown> | undefined
  if (!shift) {
    res.status(404).json({ success: false, message: "Shift not found" })
    return
  }

  const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
    {
      shop_id: auth.shop_id,
      ...(shift.terminal_id ? { terminal_id: shift.terminal_id } : {}),
      ...(shift.location_id ? { location_id: shift.location_id } : {}),
      timestamp: {
        $gte: shift.opened_at,
        $lte: new Date(),
      },
    },
    { take: 10000, order: { timestamp: "DESC" } }
  )
  const records = (snapshots as Array<Record<string, unknown>>) ?? []
  const cashSales = records
    .filter((entry) => String(entry.payment_method ?? "cash") === "cash")
    .reduce((sum, entry) => sum + asNumber(entry.amount_paid ?? entry.price_charged), 0)
  const digitalSales = records
    .filter((entry) => String(entry.payment_method ?? "cash") !== "cash")
    .reduce((sum, entry) => sum + asNumber(entry.amount_paid ?? entry.price_charged), 0)
  const expectedCash = Number(shift.opening_cash ?? 0) + cashSales

  const updated = await shiftService.updateShiftSessions({
    id: req.params.id,
    counted_cash: parsed.data.counted_cash,
    expected_cash: expectedCash,
    digital_total: Number(digitalSales.toFixed(2)),
    cash_sales_total: Number(cashSales.toFixed(2)),
    total_transactions: records.length,
    manager_note:
      parsed.data.manager_note ??
      (shift.manager_note as string | null | undefined) ??
      null,
    status: "closed",
    closed_at: new Date(),
  } as Record<string, unknown>)

  res.status(200).json({
    success: true,
    shift: shapeShift(updated as Record<string, unknown>),
    reconciliation: {
      variance: Number((parsed.data.counted_cash - expectedCash).toFixed(2)),
      expected_cash: Number(expectedCash.toFixed(2)),
      counted_cash: Number(parsed.data.counted_cash.toFixed(2)),
      cash_sales_total: Number(cashSales.toFixed(2)),
      digital_total: Number(digitalSales.toFixed(2)),
    },
  })
}
