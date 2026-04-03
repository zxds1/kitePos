import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"
import { RETURN_REQUEST_MODULE } from "../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../modules/return-request/service"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import { NotificationService } from "../../../../services/notification.service"
import {
  ReturnsService,
  generateReturnNumber,
  normalizeReturnPolicy,
  shapeReturnRequest,
} from "../../../../services/returns.service"
import { ReturnItemSchema, ReturnMethodSchema } from "../_utils"

const CreateB2CReturnSchema = z.object({
  sale_id: z.string().min(1),
  items: z.array(ReturnItemSchema).min(1),
  return_method: ReturnMethodSchema.default("drop_off"),
  customer_notes: z.string().optional().nullable(),
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

  const parsed = CreateB2CReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid B2C return request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const saleService: SaleSnapshotModuleService = req.scope.resolve(SALE_SNAPSHOT_MODULE)
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const requestService: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE
  )
  const returnsService = new ReturnsService(req.scope)

  const [sales] = await saleService.listAndCountSaleSnapshots(
    { order_id: parsed.data.sale_id, shop_id: auth.shop_id },
    { take: 500, order: { timestamp: "DESC" } }
  )
  const snapshots = (sales as Array<Record<string, unknown>>) ?? []
  if (!snapshots.length) {
    res.status(404).json({ success: false, message: "Original sale not found" })
    return
  }

  const [shops] = await shopService.listAndCountShops({ id: auth.shop_id }, { take: 1 })
  const shop = shops[0] as Record<string, unknown> | undefined
  const policy = normalizeReturnPolicy(shop?.return_policy)

  const purchaseDate = new Date(String(snapshots[0].timestamp))
  const daysSincePurchase = Math.floor(
    (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSincePurchase > policy.return_window_days) {
    res.status(400).json({
      success: false,
      message: `Return window expired (${daysSincePurchase} days > ${policy.return_window_days} days allowed)`,
    })
    return
  }

  const salesByVariant = new Map<string, Record<string, unknown>>(
    snapshots.map((entry) => [String(entry.variant_id), entry])
  )
  const items = parsed.data.items.map((item) => {
    const sale = salesByVariant.get(item.variant_id)
    const unitPrice = toNumber(sale?.price_charged)
    return {
      ...item,
      unit_price: unitPrice,
      refund_amount: Number((unitPrice * item.quantity).toFixed(2)),
    }
  })
  const totalAmount = items.reduce(
    (sum, item) => sum + toNumber(item.refund_amount),
    0
  )
  const restockingFee = Number(
    (totalAmount * (policy.restocking_fee_percent / 100)).toFixed(2)
  )
  const refundAmount = Math.max(0, totalAmount - restockingFee)
  const fraud = await returnsService.calculateFraudScore({
    shopId: auth.shop_id,
    customerId: null,
    items,
  })
  const autoApprove =
    fraud.score < 20 &&
    items.every((item) =>
      ["defective", "expired", "wrong_item"].includes(String(item.reason_category))
    )

  const created = await requestService.createReturnRequests(
    returnsService.buildCreatePayload({
      shop_id: auth.shop_id,
      return_type: "b2c_customer",
      return_number: generateReturnNumber("B2C"),
      original_sale_id: parsed.data.sale_id,
      sale_snapshot_id: String(snapshots[0].id ?? ""),
      order_reference: String(snapshots[0].order_id ?? parsed.data.sale_id),
      customer_name: null,
      items,
      total_amount: totalAmount,
      refund_amount: refundAmount,
      restocking_fee: restockingFee,
      return_reason: String(items[0].reason),
      return_reason_category: items[0].reason_category,
      item_condition: items[0].condition,
      customer_notes: parsed.data.customer_notes ?? null,
      resolution: String(policy.refund_methods[0] ?? "store_credit"),
      return_method: parsed.data.return_method,
      status: autoApprove ? "approved" : "pending",
      created_by: auth.user_id ?? null,
      fraud_score: fraud.score,
      fraud_flags: fraud.flags,
    })
  )

  if (!autoApprove) {
    await new NotificationService(req.scope).sendNotification({
      shopId: auth.shop_id,
      userType: "retailer",
      type: "new_return_request",
      title: "New return request",
      message: `Return ${String((created as Record<string, unknown>).return_number)} is awaiting approval.`,
      data: { return_id: (created as Record<string, unknown>).id },
      channels: ["push", "in_app"],
    })
  }

  res.status(201).json({
    success: true,
    return_request: shapeReturnRequest(created as Record<string, unknown>),
  })
}
