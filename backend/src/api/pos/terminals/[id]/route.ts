import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { SHOP_TERMINAL_MODULE } from "../../../../modules/shop-terminal"
import type ShopTerminalModuleService from "../../../../modules/shop-terminal/service"
import { listShopTerminals, shapeShopTerminal } from "../../_utils/terminals"
import { listActiveShopUsers } from "../../../auth/_utils/shop-users"
import { recordAuditLog } from "../../_utils/audit"
import { listShopLocations } from "../../_utils/shop-locations"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"

const UpdateTerminalSchema = z.object({
  name: z.string().trim().min(1).optional(),
  assigned_user_id: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
})

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const terminalId = req.params.id
  if (!terminalId) {
    res.status(400).json({
      success: false,
      message: "Checkout id is required",
    })
    return
  }

  const [terminals, locations, users] = await Promise.all([
    listShopTerminals(req.scope, auth.shop_id),
    listShopLocations(req.scope, auth.shop_id),
    listActiveShopUsers(req.scope, auth.shop_id),
  ])
  const terminal = terminals.find((entry) => entry.id === terminalId)

  if (!terminal) {
    res.status(404).json({
      success: false,
      message: "Checkout not found",
    })
    return
  }

  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
    {
      shop_id: auth.shop_id,
      terminal_id: terminalId,
      timestamp: {
        $gte: startOfToday(),
      },
    },
    {
      take: 200,
      order: {
        timestamp: "DESC",
      },
    }
  )

  const location = locations.find((entry) => entry.id === terminal.location_id)
  const assignedUser = users.find((entry) => entry.id === terminal.assigned_user_id)
  const snapshotRecords = (snapshots as Array<Record<string, unknown>>) ?? []
  const totalSales = snapshotRecords.reduce(
    (sum, snapshot) =>
      sum + asNumber(snapshot.amount_paid ?? snapshot.price_charged),
    0
  )
  const mpesaCount = snapshotRecords.filter(
    (snapshot) => String(snapshot.payment_method ?? "").toLowerCase() === "mpesa"
  ).length
  const cashCount = snapshotRecords.filter(
    (snapshot) => String(snapshot.payment_method ?? "").toLowerCase() === "cash"
  ).length
  const cardCount = snapshotRecords.length - mpesaCount - cashCount

  res.status(200).json({
    success: true,
    terminal: shapeShopTerminal(terminal),
    summary: {
      location_name: location?.name ?? null,
      assigned_user_name: assignedUser?.full_name ?? null,
      total_sales: Number(totalSales.toFixed(2)),
      transaction_count: snapshotRecords.length,
      mpesa_count: mpesaCount,
      cash_count: cashCount,
      card_count: cardCount,
      last_transaction_at: snapshotRecords[0]?.timestamp ?? null,
    },
    recent_transactions: snapshotRecords.slice(0, 8).map((snapshot) => ({
      id: snapshot.id,
      client_transaction_id: snapshot.client_transaction_id ?? null,
      payment_method: snapshot.payment_method ?? "cash",
      amount_paid: snapshot.amount_paid ?? snapshot.price_charged ?? 0,
      price_charged: snapshot.price_charged ?? 0,
      timestamp: snapshot.timestamp ?? null,
    })),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can update checkouts",
    })
    return
  }

  const terminalId = req.params.id
  if (!terminalId) {
    res.status(400).json({
      success: false,
      message: "Checkout id is required",
    })
    return
  }

  const parsed = UpdateTerminalSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request format",
      errors: parsed.error.flatten(),
    })
    return
  }

  const terminals = await listShopTerminals(req.scope, auth.shop_id)
  const existing = terminals.find((terminal) => terminal.id === terminalId)
  if (!existing) {
    res.status(404).json({
      success: false,
      message: "Checkout not found",
    })
    return
  }

  if (parsed.data.assigned_user_id) {
    const users = await listActiveShopUsers(req.scope, auth.shop_id)
    const assignedUser = users.find((user) => user.id === parsed.data.assigned_user_id)
    if (!assignedUser) {
      res.status(400).json({
        success: false,
        message: "Assigned staff user not found",
      })
      return
    }
  }

  const service: ShopTerminalModuleService = req.scope.resolve(SHOP_TERMINAL_MODULE)
  const updated = await service.updateShopTerminals({
    id: terminalId,
    name: parsed.data.name ?? existing.name,
    assigned_user_id:
      parsed.data.assigned_user_id !== undefined
        ? parsed.data.assigned_user_id
        : existing.assigned_user_id ?? null,
    is_active: parsed.data.is_active ?? (existing.is_active !== false),
  } as unknown as Record<string, unknown>)

  await recordAuditLog(req.scope, {
    shop_id: auth.shop_id,
    actor_user_id: auth.user_id ?? null,
    actor_role: auth.role ?? null,
    action: "terminal.updated",
    entity_type: "terminal",
    entity_id: terminalId,
    location_id: existing.location_id,
    metadata: {
      assigned_user_id:
        parsed.data.assigned_user_id !== undefined
          ? parsed.data.assigned_user_id
          : existing.assigned_user_id ?? null,
      is_active: parsed.data.is_active ?? (existing.is_active !== false),
    },
  })

  res.status(200).json({
    success: true,
    terminal: shapeShopTerminal(updated as never),
  })
}
