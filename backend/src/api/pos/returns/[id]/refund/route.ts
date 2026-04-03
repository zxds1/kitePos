import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { canManageBranches } from "../../../../auth/_utils/shop-users"
import { RETURN_REQUEST_MODULE } from "../../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../../modules/return-request/service"
import { REFUND_TRANSACTION_MODULE } from "../../../../../modules/refund-transaction"
import type RefundTransactionModuleService from "../../../../../modules/refund-transaction/service"
import { NotificationService } from "../../../../../services/notification.service"
import { LoyaltyService } from "../../../../../services/loyalty.service"
import { TaxService } from "../../../../../services/tax.service"
import { shapeReturnRequest } from "../../../../../services/returns.service"
import { RefundMethodSchema } from "../../_utils"

const ProcessRefundSchema = z.object({
  refund_method: RefundMethodSchema,
  mpesa_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }
  if (!canManageBranches(auth.role)) {
    res.status(403).json({
      success: false,
      message: "Only owner or admin can process refunds",
    })
    return
  }

  const parsed = ProcessRefundSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid refund request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const requestService: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE
  )
  const refundService: RefundTransactionModuleService = req.scope.resolve(
    REFUND_TRANSACTION_MODULE
  )
  const loyalty = new LoyaltyService(req.scope)

  const [entries] = await requestService.listAndCountReturnRequests(
    { id: req.params.id, shop_id: auth.shop_id },
    { take: 1 }
  )
  const existing = entries[0] as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, message: "Return not found" })
    return
  }

  const currentStatus = String(existing.status ?? "pending")
  if (!["approved", "received", "inspected"].includes(currentStatus)) {
    res.status(400).json({
      success: false,
      message: "Return must be approved and received before refund",
    })
    return
  }

  const refundAmount = toNumber(existing.refund_amount)
  const restockingFee = toNumber(existing.restocking_fee)
  const shippingRefund = toNumber(existing.return_shipping_cost)
  const totalRefund = refundAmount

  const transaction = await refundService.createRefundTransactions({
    id: `rfd_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    return_id: req.params.id,
    original_sale_id:
      typeof existing.original_sale_id === "string" ? existing.original_sale_id : null,
    shop_id: auth.shop_id,
    refund_amount: refundAmount,
    restocking_fee: restockingFee,
    shipping_refund: shippingRefund,
    total_refund: totalRefund,
    refund_method: parsed.data.refund_method,
    mpesa_receipt: parsed.data.refund_method === "mpesa" ? parsed.data.mpesa_phone ?? null : null,
    status:
      parsed.data.refund_method === "mpesa" ? "processing" : "completed",
    processed_by: auth.user_id ?? auth.shop_id,
    processed_at:
      parsed.data.refund_method === "mpesa" ? null : new Date(),
    bank_reference: null,
    store_credit_id: null,
  } as Record<string, unknown>)

  const updated = await requestService.updateReturnRequests({
    id: req.params.id,
    refund_status:
      parsed.data.refund_method === "mpesa" ? "processing" : "completed",
    refund_transaction_id: (transaction as Record<string, unknown>).id,
    refunded_at:
      parsed.data.refund_method === "mpesa" ? null : new Date(),
    status:
      parsed.data.refund_method === "mpesa" ? currentStatus : "completed",
    notes:
      parsed.data.notes ??
      (typeof existing.notes === "string" ? existing.notes : null),
  } as Record<string, unknown>)

  await loyalty.reversePointsForReturn({
    shopId: auth.shop_id,
    returnRequestId: req.params.id,
    saleSnapshotId:
      typeof existing.sale_snapshot_id === "string" ? existing.sale_snapshot_id : null,
    saleId:
      typeof existing.original_sale_id === "string"
        ? existing.original_sale_id
        : typeof existing.original_order_id === "string"
          ? existing.original_order_id
          : null,
    createdBy: auth.user_id ?? auth.shop_id,
  })

  await new NotificationService(req.scope).sendNotification({
    shopId: auth.shop_id,
    userType: "retailer",
    type: "refund_processed",
    title: "Refund processed",
    message: `Refund of KES ${refundAmount.toFixed(0)} was processed via ${parsed.data.refund_method}.`,
    data: {
      return_id: req.params.id,
      refund_transaction_id: (transaction as Record<string, unknown>).id,
    },
    channels: ["push", "sms", "in_app"],
  })

  const creditNote = await new TaxService(req.scope).createCreditNoteForReturn({
    shopId: auth.shop_id,
    originalSaleId:
      typeof existing.original_sale_id === "string"
        ? existing.original_sale_id
        : typeof existing.original_order_id === "string"
          ? existing.original_order_id
          : null,
    returnId: req.params.id,
    refundAmount,
    reason: parsed.data.notes ?? "Return refund processed",
    createdBy: auth.user_id ?? auth.shop_id,
  })

  res.status(200).json({
    success: true,
    return_request: shapeReturnRequest(updated as Record<string, unknown>),
    refund_transaction: transaction,
    credit_note: creditNote,
  })
}
