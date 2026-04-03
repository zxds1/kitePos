import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { SHIFT_SESSION_MODULE } from "../../../modules/shift-session"
import type ShiftSessionModuleService from "../../../modules/shift-session/service"

const OpenShiftSchema = z.object({
  location_id: z.string().trim().optional().nullable(),
  terminal_id: z.string().trim().optional().nullable(),
  opening_cash: z.coerce.number().min(0).default(0),
  manager_note: z.string().trim().optional().nullable(),
})

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: ShiftSessionModuleService = req.scope.resolve(SHIFT_SESSION_MODULE)
  const [shifts] = await service.listAndCountShiftSessions(
    { shop_id: auth.shop_id },
    { take: 100, order: { opened_at: "DESC" } }
  )

  res.status(200).json({
    success: true,
    active_shift:
      (shifts as Array<Record<string, unknown>>)
        .find((shift) => String(shift.status ?? "active") === "active")
        ? shapeShift(
            (shifts as Array<Record<string, unknown>>).find(
              (shift) => String(shift.status ?? "active") === "active"
            ) as Record<string, unknown>
          )
        : null,
    shifts: (shifts as Array<Record<string, unknown>>).map(shapeShift),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = OpenShiftSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid shift payload", errors: parsed.error.flatten() })
    return
  }

  const service: ShiftSessionModuleService = req.scope.resolve(SHIFT_SESSION_MODULE)
  const [existing] = await service.listAndCountShiftSessions(
    {
      shop_id: auth.shop_id,
      terminal_id: parsed.data.terminal_id ?? null,
      status: "active",
    },
    { take: 1 }
  )
  if ((existing as Array<unknown>).length > 0) {
    res.status(409).json({ success: false, message: "An active shift already exists for this terminal" })
    return
  }

  const created = await service.createShiftSessions({
    id: `shf_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    shop_id: auth.shop_id,
    location_id: parsed.data.location_id ?? null,
    terminal_id: parsed.data.terminal_id ?? null,
    staff_user_id: auth.user_id ?? null,
    opening_cash: parsed.data.opening_cash,
    expected_cash: parsed.data.opening_cash,
    counted_cash: null,
    digital_total: 0,
    cash_sales_total: 0,
    total_transactions: 0,
    status: "active",
    manager_note: parsed.data.manager_note ?? null,
    opened_at: new Date(),
  } as Record<string, unknown>)

  res.status(201).json({ success: true, shift: shapeShift(created as Record<string, unknown>) })
}
