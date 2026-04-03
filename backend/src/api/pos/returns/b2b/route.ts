import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { PURCHASE_ORDER_MODULE } from "../../../../modules/purchase-order"
import type PurchaseOrderModuleService from "../../../../modules/purchase-order/service"
import { RETURN_REQUEST_MODULE } from "../../../../modules/return-request"
import type ReturnRequestModuleService from "../../../../modules/return-request/service"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import { NotificationService } from "../../../../services/notification.service"
import {
  ReturnsService,
  generateReturnNumber,
  normalizeB2BReturnPolicy,
  shapeReturnRequest,
} from "../../../../services/returns.service"
import { ReturnItemSchema, ReturnMethodSchema } from "../_utils"

const CreateB2BReturnSchema = z.object({
  supplier_shop_id: z.string().min(1),
  purchase_order_id: z.string().min(1),
  items: z.array(ReturnItemSchema).min(1),
  return_method: ReturnMethodSchema.default("pickup"),
  retailer_notes: z.string().optional().nullable(),
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

  const parsed = CreateB2BReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid B2B return request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const purchaseOrderService: PurchaseOrderModuleService = req.scope.resolve(
    PURCHASE_ORDER_MODULE
  )
  const requestService: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE
  )
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const returnsService = new ReturnsService(req.scope)

  const [orders] = await purchaseOrderService.listAndCountPurchaseOrders(
    {
      id: parsed.data.purchase_order_id,
      retailer_shop_id: auth.shop_id,
      supplier_shop_id: parsed.data.supplier_shop_id,
    },
    { take: 1 }
  )
  const order = orders[0] as Record<string, unknown> | undefined
  if (!order) {
    res.status(404).json({ success: false, message: "Purchase order not found" })
    return
  }

  const [shops] = await shopService.listAndCountShops(
    { id: parsed.data.supplier_shop_id },
    { take: 1 }
  )
  const supplierShop = shops[0] as Record<string, unknown> | undefined
  const policy = normalizeB2BReturnPolicy(supplierShop?.b2b_return_policy)
  if (!policy.accepts_returns) {
    res.status(400).json({
      success: false,
      message: "This supplier does not accept returns",
    })
    return
  }

  const orderDate = new Date(String(order.created_at))
  const daysSincePurchase = Math.floor(
    (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSincePurchase > policy.return_window_days) {
    res.status(400).json({
      success: false,
      message: `B2B return window expired (${daysSincePurchase} days > ${policy.return_window_days} days)`,
    })
    return
  }

  const orderItems = Array.isArray(order.items)
    ? (order.items as Array<Record<string, unknown>>)
    : []
  const orderItemsByVariant = new Map<string, Record<string, unknown>>(
    orderItems.map((item) => [String(item.variant_id), item])
  )
  const items = parsed.data.items.map((item) => {
    const orderItem = orderItemsByVariant.get(item.variant_id)
    const unitPrice = toNumber(orderItem?.unit_price)
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

  const created = await requestService.createReturnRequests(
    returnsService.buildCreatePayload({
      shop_id: auth.shop_id,
      supplier_shop_id: parsed.data.supplier_shop_id,
      return_type: "b2b_retailer",
      return_number: generateReturnNumber("B2B"),
      original_order_id: parsed.data.purchase_order_id,
      order_reference: String(order.id ?? parsed.data.purchase_order_id),
      items,
      total_amount: totalAmount,
      refund_amount: totalAmount,
      restocking_fee: 0,
      return_reason: String(items[0].reason),
      return_reason_category: items[0].reason_category,
      item_condition: items[0].condition,
      customer_notes: parsed.data.retailer_notes ?? null,
      resolution: String(policy.refund_methods[0] ?? "store_credit"),
      return_method: parsed.data.return_method,
      status: "pending",
      created_by: auth.user_id ?? null,
    })
  )

  await new NotificationService(req.scope).sendNotification({
    shopId: parsed.data.supplier_shop_id,
    userType: "supplier",
    type: "b2b_return_request",
    title: "New B2B return request",
    message: `Return ${String((created as Record<string, unknown>).return_number)} is awaiting supplier review.`,
    data: {
      return_id: (created as Record<string, unknown>).id,
      retailer_shop_id: auth.shop_id,
      total_amount: totalAmount,
    },
    channels: ["push", "sms", "in_app"],
  })

  res.status(201).json({
    success: true,
    return_request: shapeReturnRequest(created as Record<string, unknown>),
  })
}
