import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { canManageBranches } from "../../../../auth/_utils/shop-users"
import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../modules/return-request/service"
import { NotificationService } from "../../../../../services/notification.service"
import { shapeReturnRequest } from "../../../../../services/returns.service"

const DecideReturnSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  rejection_reason: z.string().optional().nullable(),
  refund_amount_override: z.coerce.number().min(0).optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = DecideReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: ReturnRequestModuleService = req.scope.resolve(RETURN_REQUEST_MODULE)
  const [entries] = await service.listAndCountReturnRequests(
    { id: req.params.id },
    { take: 1 }
  )
  const existing = entries[0] as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, message: "Return not found" })
    return
  }

  const canDecide =
    (String(existing.return_type) === "b2b_retailer" &&
      String(existing.supplier_shop_id ?? "") === auth.shop_id) ||
    (String(existing.return_type) !== "b2b_retailer" &&
      String(existing.shop_id ?? "") === auth.shop_id &&
      canManageBranches(auth.role))

  if (!canDecide) {
    res.status(403).json({
      success: false,
      message: "Not authorized to decide this return",
    })
    return
  }

  const update: Record<string, unknown> = {
    id: req.params.id,
    status: parsed.data.decision === "approve" ? "approved" : "rejected",
    approved_by: auth.user_id ?? auth.shop_id,
    approved_at: parsed.data.decision === "approve" ? new Date() : null,
    rejected_at: parsed.data.decision === "reject" ? new Date() : null,
    rejection_reason: parsed.data.rejection_reason ?? null,
    decided_by: auth.user_id ?? auth.shop_id,
    decided_at: new Date(),
  }
  if (parsed.data.refund_amount_override != null) {
    update.refund_amount = parsed.data.refund_amount_override
  }

  const updated = await service.updateReturnRequests(update)

  await new NotificationService(req.scope).sendNotification({
    shopId: String(existing.shop_id),
    userType: "retailer",
    type:
      parsed.data.decision === "approve" ? "return_approved" : "return_rejected",
    title:
      parsed.data.decision === "approve" ? "Return approved" : "Return rejected",
    message:
      parsed.data.decision === "approve"
        ? `Return ${String(existing.return_number ?? existing.id)} has been approved.`
        : `Return ${String(existing.return_number ?? existing.id)} was rejected.`,
    data: { return_id: existing.id },
    channels: ["push", "sms", "in_app"],
  })

  res.status(200).json({
    success: true,
    return_request: shapeReturnRequest(updated as Record<string, unknown>),
  })
}
