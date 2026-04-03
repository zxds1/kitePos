import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { SALE_SNAPSHOT_MODULE } from "../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../modules/sale-snapshot/service"
import { POST as adminBatchSales } from "../../admin/inventory/batch-sales/route"
import { AdminBatchSalesRequest } from "../../admin/inventory/batch-sales/validator"
import { canUseLocation } from "../../auth/_utils/shop-users"
import { canUseTerminal, listShopTerminals } from "../_utils/terminals"

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type SaleSnapshotRecord = {
  id?: string
  order_id?: string
  client_transaction_id?: string | null
  location_id?: string | null
  terminal_id?: string | null
  payment_method?: string | null
  amount_paid?: number | string | null
  price_charged?: number | string | null
  quantity_sold?: number | string | null
  sync_status?: string | null
  sync_conflict?: unknown
  timestamp?: string | Date | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const locationId =
    typeof req.query.location_id === "string" && req.query.location_id.trim().length
      ? req.query.location_id.trim()
      : null
  const terminalId =
    typeof req.query.terminal_id === "string" && req.query.terminal_id.trim().length
      ? req.query.terminal_id.trim()
      : null
  const limitCandidate =
    typeof req.query.limit === "string" ? Number(req.query.limit) : Number(req.query.limit ?? 50)
  const limit =
    Number.isFinite(limitCandidate) && limitCandidate > 0
      ? Math.min(Math.trunc(limitCandidate), 100)
      : 50

  if (locationId && !canUseLocation(auth, locationId)) {
    res.status(403).json({
      success: false,
      message: "Location access denied",
    })
    return
  }

  if (terminalId) {
    const terminals = await listShopTerminals(req.scope, auth.shop_id)
    const terminal = terminals.find((entry) => entry.id === terminalId)
    if (!terminal || !canUseTerminal(auth, terminal)) {
      res.status(403).json({
        success: false,
        message: "Checkout access denied",
      })
      return
    }
  }

  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const filters: Record<string, unknown> = {
    shop_id: auth.shop_id,
  }

  if (locationId) {
    filters.location_id = locationId
  }

  if (terminalId) {
    filters.terminal_id = terminalId
  }

  const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(filters, {
    take: 500,
    order: {
      timestamp: "DESC",
    },
  })

  const grouped = new Map<
    string,
    {
      order_id: string | null
      client_transaction_id: string | null
      location_id: string | null
      terminal_id: string | null
      payment_method: string
      amount_paid: number
      total_amount: number
      item_count: number
      quantity_total: number
      timestamp: string | Date | null
      sync_status: string
      has_conflict: boolean
    }
  >()

  for (const snapshot of (snapshots as SaleSnapshotRecord[]) ?? []) {
    const key =
      snapshot.order_id ||
      snapshot.client_transaction_id ||
      snapshot.id ||
      `snapshot:${grouped.size}`

    const existing = grouped.get(key)
    const priceCharged = asNumber(snapshot.price_charged)
    const amountPaid = asNumber(snapshot.amount_paid)
    const quantitySold = asNumber(snapshot.quantity_sold)

    if (existing) {
      existing.total_amount += priceCharged
      existing.item_count += 1
      existing.quantity_total += quantitySold || 1
      existing.has_conflict = existing.has_conflict || Boolean(snapshot.sync_conflict)
      continue
    }

    grouped.set(key, {
      order_id: snapshot.order_id ?? null,
      client_transaction_id: snapshot.client_transaction_id ?? null,
      location_id: snapshot.location_id ?? null,
      terminal_id: snapshot.terminal_id ?? null,
      payment_method: snapshot.payment_method || "cash",
      amount_paid: amountPaid || priceCharged,
      total_amount: priceCharged,
      item_count: 1,
      quantity_total: quantitySold || 1,
      timestamp: snapshot.timestamp ?? null,
      sync_status: snapshot.sync_status || "success",
      has_conflict: Boolean(snapshot.sync_conflict),
    })
  }

  const sales = Array.from(grouped.values()).slice(0, limit)

  res.status(200).json({
    success: true,
    count: sales.length,
    sales,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth) {
    return
  }

  const body = (req.body as Record<string, unknown> | undefined) ?? {}
  const parsed = AdminBatchSalesRequest.safeParse({
    ...body,
    shop_id: auth.shop_id,
  })

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  ;(req as MedusaRequest & { validatedBody?: unknown }).validatedBody = parsed.data
  await adminBatchSales(req, res)
}
