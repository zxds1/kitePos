import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { canManageBranches } from "../../../auth/_utils/shop-users"
import { RETURN_REQUEST_MODULE } from "../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../modules/return-request/service"
import { RESTOCK_MODULE } from "../../../../modules/restock"
import type RestockModuleService from "../../../../modules/restock/service"
import { NotificationService } from "../../../../services/notification.service"
import { shapeReturnRequest } from "../../../../services/returns.service"
import { syncAggregateInventoryLevelForVariant } from "../../../admin/products/_utils"

const UpdateReturnSchema = z.object({
  status: z
    .enum([
      "pending",
      "approved",
      "denied",
      "rejected",
      "received",
      "inspected",
      "refunded",
      "completed",
      "cancelled",
    ])
    .optional(),
  resolution: z
    .enum([
      "store_credit",
      "original_payment",
      "exchange",
      "bank_transfer",
      "cash",
      "mpesa",
    ])
    .optional(),
  notes: z.string().trim().optional().nullable(),
  tracking_number: z.string().trim().optional().nullable(),
  rejection_reason: z.string().trim().optional().nullable(),
})

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function restockEligibleItems(
  req: MedusaRequest,
  shopId: string,
  entry: Record<string, unknown>
) {
  const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
  const items = Array.isArray(entry.items) ? entry.items : []
  for (const rawItem of items as Array<Record<string, unknown>>) {
    const variantId = String(rawItem.variant_id ?? "")
    if (!variantId) {
      continue
    }
    const condition = String(rawItem.condition ?? entry.item_condition ?? "new")
    if (["damaged", "expired", "used"].includes(condition)) {
      continue
    }
    const quantity = toNumber(rawItem.quantity, 1)
    if (quantity <= 0) {
      continue
    }

    await restockService.createRestocks({
      id: `rst_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: shopId,
      location_id: null,
      variant_id: variantId,
      idempotency_key: `return:${String(entry.id)}:${variantId}`,
      quantity_received: quantity,
      purchase_unit_qty: quantity,
      cost_per_unit: 0,
      total_cost: 0,
      source: "manual",
      supplier_name: "Return intake",
      conversion_snapshot: {
        source: "return_request",
        return_id: entry.id,
      },
      timestamp: new Date(),
    } as Record<string, unknown>)

    await syncAggregateInventoryLevelForVariant(req, shopId, variantId)
  }
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = UpdateReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid return update payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: ReturnRequestModuleService = req.scope.resolve(RETURN_REQUEST_MODULE)
  const [requests] = await service.listAndCountReturnRequests(
    { id: req.params.id },
    { take: 1 }
  )
  const existing = requests[0] as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, message: "Return request not found" })
    return
  }

  const isRequester = String(existing.shop_id ?? "") === auth.shop_id
  const isSupplier = String(existing.supplier_shop_id ?? "") === auth.shop_id
  const canReview = canManageBranches(auth.role)
  const nextStatus = parsed.data.status

  if (!isRequester && !isSupplier && !canReview) {
    res.status(403).json({ success: false, message: "Access denied" })
    return
  }

  if (
    nextStatus &&
    ["approved", "denied", "rejected"].includes(nextStatus) &&
    !(isSupplier || canReview)
  ) {
    res.status(403).json({
      success: false,
      message: "Only authorized reviewers can decide this return",
    })
    return
  }

  const update: Record<string, unknown> = {
    id: req.params.id,
    ...parsed.data,
  }

  if (nextStatus === "approved") {
    update.approved_by = auth.user_id ?? auth.shop_id
    update.approved_at = new Date()
    update.decided_by = auth.user_id ?? auth.shop_id
    update.decided_at = new Date()
  } else if (nextStatus === "denied" || nextStatus === "rejected") {
    update.rejected_at = new Date()
    update.decided_by = auth.user_id ?? auth.shop_id
    update.decided_at = new Date()
  } else if (nextStatus === "received") {
    update.received_at = new Date()
    update.received_by = auth.user_id ?? auth.shop_id
  } else if (nextStatus === "completed") {
    update.refunded_at = existing.refunded_at ?? new Date()
  }

  const updated = await service.updateReturnRequests(update)

  if (nextStatus === "received" && isRequester) {
    await restockEligibleItems(req, auth.shop_id, existing)
  }

  const notifications = new NotificationService(req.scope)
  if (nextStatus === "approved") {
    await notifications.sendNotification({
      shopId: String(existing.shop_id),
      userType: "retailer",
      type: "return_approved",
      title: "Return approved",
      message: `Return ${String(existing.return_number ?? existing.id)} has been approved.`,
      data: { return_id: existing.id },
      channels: ["push", "sms", "in_app"],
    })
  } else if (nextStatus === "denied" || nextStatus === "rejected") {
    await notifications.sendNotification({
      shopId: String(existing.shop_id),
      userType: "retailer",
      type: "return_rejected",
      title: "Return rejected",
      message: `Return ${String(existing.return_number ?? existing.id)} was rejected.`,
      data: { return_id: existing.id },
      channels: ["push", "sms", "in_app"],
    })
  } else if (nextStatus === "received") {
    await notifications.sendNotification({
      shopId: String(existing.shop_id),
      userType: "retailer",
      type: "return_received",
      title: "Return received",
      message: `Returned items for ${String(existing.return_number ?? existing.id)} were received.`,
      data: { return_id: existing.id },
      channels: ["push", "in_app"],
    })
  }

  res.status(200).json({
    success: true,
    return_request: shapeReturnRequest(updated as Record<string, unknown>),
  })
}
