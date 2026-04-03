import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { PURCHASE_ORDER_MODULE } from "../../../../modules/purchase-order"
import type PurchaseOrderModuleService from "../../../../modules/purchase-order/service"
import { NotificationService } from "../../../../services/notification.service"

const UpdatePurchaseOrderSchema = z.object({
  status: z
    .enum(["pending", "confirmed", "dispatched", "delivered", "cancelled"])
    .optional(),
  delivery_status: z
    .enum(["pending", "scheduled", "in_transit", "delivered", "failed"])
    .optional(),
  delivery_tracking_info: z.string().optional().nullable(),
  payment_status: z
    .enum(["pending", "paid", "partial", "refunded", "cod"])
    .optional(),
  mpesa_receipt: z.string().optional().nullable(),
  cancellation_reason: z.string().optional().nullable(),
})

function shapePurchaseOrder(order: Record<string, unknown>) {
  return {
    id: String(order.id),
    retailer_shop_id: String(order.retailer_shop_id),
    supplier_shop_id: String(order.supplier_shop_id),
    status: String(order.status ?? "pending"),
    items: Array.isArray(order.items) ? order.items : [],
    subtotal_amount: Number(order.subtotal_amount ?? 0),
    total_amount: Number(order.total_amount ?? 0),
    delivery_method: String(order.delivery_method ?? "delivery"),
    delivery_fee: Number(order.delivery_fee ?? 0),
    delivery_status: String(order.delivery_status ?? "pending"),
    payment_status: String(order.payment_status ?? "pending"),
    delivery_tracking_info:
      typeof order.delivery_tracking_info === "string"
        ? order.delivery_tracking_info
        : null,
    mpesa_receipt: typeof order.mpesa_receipt === "string" ? order.mpesa_receipt : null,
    cancelled_at: order.cancelled_at ?? null,
    cancellation_reason:
      typeof order.cancellation_reason === "string"
        ? order.cancellation_reason
        : null,
    created_at: order.created_at ?? null,
    updated_at: order.updated_at ?? null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: PurchaseOrderModuleService = req.scope.resolve(PURCHASE_ORDER_MODULE)
  const [orders] = await service.listAndCountPurchaseOrders(
    { id: req.params.id },
    { take: 1 }
  )
  const order = orders[0] as Record<string, unknown> | undefined
  if (!order) {
    res.status(404).json({ success: false, message: "Order not found" })
    return
  }
  if (
    String(order.retailer_shop_id) !== auth.shop_id &&
    String(order.supplier_shop_id) !== auth.shop_id
  ) {
    res.status(403).json({ success: false, message: "Access denied" })
    return
  }

  res.status(200).json({ success: true, order: shapePurchaseOrder(order) })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = UpdatePurchaseOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid order update payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: PurchaseOrderModuleService = req.scope.resolve(PURCHASE_ORDER_MODULE)
  const [orders] = await service.listAndCountPurchaseOrders(
    { id: req.params.id },
    { take: 1 }
  )
  const order = orders[0] as Record<string, unknown> | undefined
  if (!order) {
    res.status(404).json({ success: false, message: "Order not found" })
    return
  }

  const isRetailer = String(order.retailer_shop_id) === auth.shop_id
  const isSupplier = String(order.supplier_shop_id) === auth.shop_id
  if (!isRetailer && !isSupplier) {
    res.status(403).json({ success: false, message: "Access denied" })
    return
  }

  if (parsed.data.status != null) {
    const supplierStatuses = new Set(["confirmed", "dispatched", "delivered"])
    if (supplierStatuses.has(parsed.data.status) && !isSupplier) {
      res.status(403).json({
        success: false,
        message: "Only the supplier can move this order forward",
      })
      return
    }
    if (parsed.data.status === "cancelled" && !isRetailer && !isSupplier) {
      res.status(403).json({ success: false, message: "Access denied" })
      return
    }
  }

  const update: Record<string, unknown> = {
    id: req.params.id,
    ...parsed.data,
  }
  if (parsed.data.status === "cancelled") {
    update.cancelled_at = new Date()
    update.cancelled_by = isSupplier ? "supplier" : "retailer"
  }

  const [updated] = await service.updatePurchaseOrders([update])

  const notifications = new NotificationService(req.scope)
  if (parsed.data.status === "confirmed") {
    await notifications.sendNotification({
      shopId: String(order.retailer_shop_id),
      userType: "retailer",
      type: "order_confirmed",
      title: "Order confirmed",
      message: `Supplier confirmed order ${req.params.id}.`,
      data: { order_id: req.params.id },
      channels: ["push", "in_app"],
    })
  } else if (parsed.data.status === "dispatched") {
    await notifications.sendNotification({
      shopId: String(order.retailer_shop_id),
      userType: "retailer",
      type: "order_dispatched",
      title: "Order dispatched",
      message: `Supplier dispatched order ${req.params.id}.`,
      data: { order_id: req.params.id },
      channels: ["push", "sms", "in_app"],
    })
  } else if (parsed.data.status === "delivered") {
    await notifications.sendNotification({
      shopId: String(order.retailer_shop_id),
      userType: "retailer",
      type: "order_delivered",
      title: "Order delivered",
      message: `Order ${req.params.id} has been marked delivered.`,
      data: { order_id: req.params.id },
      channels: ["push", "in_app"],
    })
  }

  res.status(200).json({
    success: true,
    order: shapePurchaseOrder(updated as Record<string, unknown>),
  })
}
