import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { PURCHASE_ORDER_MODULE } from "../../../modules/purchase-order"
import type PurchaseOrderModuleService from "../../../modules/purchase-order/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { NotificationService } from "../../../services/notification.service"
import {
  computeDeliveryFee,
  findSupplierRecord,
  getSupplierShop,
  listSupplierCatalog,
  normalizeDeliveryOptions,
} from "../suppliers/_utils/network"

type CatalogItem = Awaited<ReturnType<typeof listSupplierCatalog>>[number]

const ItemSchema = z.object({
  variant_id: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

const CreatePurchaseOrderSchema = z.object({
  supplier_shop_id: z.string().min(1),
  items: z.array(ItemSchema).min(1),
  notes: z.string().optional().nullable(),
  delivery_method: z.enum(["pickup", "delivery", "third_party"]).default("delivery"),
})

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function shapePurchaseOrder(order: Record<string, unknown>) {
  return {
    id: String(order.id),
    retailer_shop_id: String(order.retailer_shop_id),
    supplier_shop_id: String(order.supplier_shop_id),
    supplier_id: order.supplier_id == null ? null : String(order.supplier_id),
    status: String(order.status ?? "pending"),
    items: Array.isArray(order.items) ? order.items : [],
    subtotal_amount: toNumber(order.subtotal_amount),
    total_amount: toNumber(order.total_amount),
    notes: typeof order.notes === "string" ? order.notes : null,
    delivery_method: String(order.delivery_method ?? "delivery"),
    delivery_fee: toNumber(order.delivery_fee),
    delivery_status: String(order.delivery_status ?? "pending"),
    delivery_tracking_info:
      typeof order.delivery_tracking_info === "string"
        ? order.delivery_tracking_info
        : null,
    payment_status: String(order.payment_status ?? "pending"),
    payment_due_date: order.payment_due_date ?? null,
    mpesa_receipt: typeof order.mpesa_receipt === "string" ? order.mpesa_receipt : null,
    auto_reorder_rule_id:
      typeof order.auto_reorder_rule_id === "string"
        ? order.auto_reorder_rule_id
        : null,
    cancelled_at: order.cancelled_at ?? null,
    cancellation_reason:
      typeof order.cancellation_reason === "string"
        ? order.cancellation_reason
        : null,
    cancelled_by: typeof order.cancelled_by === "string" ? order.cancelled_by : null,
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
  const scope = typeof req.query.scope === "string" ? req.query.scope : "retailer"

  const filters =
    scope === "supplier"
      ? { supplier_shop_id: auth.shop_id }
      : scope === "all"
        ? {}
        : { retailer_shop_id: auth.shop_id }

  const [orders] = await service.listAndCountPurchaseOrders(filters, {
    take: 200,
    order: { created_at: "DESC" },
  })

  const shaped = (orders as Array<Record<string, unknown>>).filter((order) => {
    if (scope === "all") {
      return (
        String(order.retailer_shop_id) === auth.shop_id ||
        String(order.supplier_shop_id) === auth.shop_id
      )
    }
    return true
  }).map(shapePurchaseOrder)

  res.status(200).json({ success: true, orders: shaped })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = CreatePurchaseOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid purchase order payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const supplierShop = await getSupplierShop(req.scope, parsed.data.supplier_shop_id)
  if (!supplierShop) {
    res.status(404).json({ success: false, message: "Supplier shop not found" })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [retailerShops] = await shopService.listAndCountShops(
    { id: auth.shop_id },
    { take: 1 }
  )
  const retailerShop = retailerShops[0] as Record<string, unknown> | undefined
  if (!retailerShop) {
    res.status(404).json({ success: false, message: "Retailer shop not found" })
    return
  }

  const catalog = await listSupplierCatalog(req, parsed.data.supplier_shop_id)
  const catalogByVariant = new Map(catalog.map((item) => [item.variant_id, item]))

  const items: Array<Record<string, unknown>> = []
  let subtotal = 0
  for (const item of parsed.data.items) {
    const catalogItem = catalogByVariant.get(item.variant_id) as
      | CatalogItem
      | undefined
    if (!catalogItem) {
      res.status(400).json({
        success: false,
        message: `Product ${item.variant_id} is not in the supplier catalog`,
      })
      return
    }
    if (catalogItem.stock_available < item.quantity) {
      res.status(400).json({
        success: false,
        message: `${catalogItem.product_name} does not have enough stock`,
      })
      return
    }

    const lineSubtotal = Number(
      (catalogItem.wholesale_price * item.quantity).toFixed(2)
    )
    subtotal += lineSubtotal
    items.push({
      variant_id: item.variant_id,
      product_name: catalogItem.product_name,
      quantity: item.quantity,
      unit_price: catalogItem.wholesale_price,
      subtotal: lineSubtotal,
      unit: catalogItem.unit,
    })
  }

  const deliveryOptions = normalizeDeliveryOptions(supplierShop.delivery_options)
  if (!deliveryOptions.methods.includes(parsed.data.delivery_method)) {
    res.status(400).json({
      success: false,
      message: "Selected fulfilment method is not supported by this supplier",
    })
    return
  }
  if (
    parsed.data.delivery_method === "delivery" &&
    deliveryOptions.areas.length > 0 &&
    retailerShop.ward_code != null &&
    !deliveryOptions.areas.includes(String(retailerShop.ward_code))
  ) {
    res.status(400).json({
      success: false,
      message: "Supplier does not deliver to your area",
    })
    return
  }

  if (subtotal < deliveryOptions.min_order) {
    const minimumOrder = deliveryOptions.min_order.toFixed(0)
    res.status(400).json({
      success: false,
      message: `Minimum supplier order is KES ${minimumOrder}`,
    })
    return
  }

  const deliveryFee =
    parsed.data.delivery_method === "delivery"
      ? computeDeliveryFee(deliveryOptions, subtotal)
      : 0

  const supplierRecord = await findSupplierRecord(
    req.scope,
    auth.shop_id,
    parsed.data.supplier_shop_id
  )

  const service: PurchaseOrderModuleService = req.scope.resolve(PURCHASE_ORDER_MODULE)
  const created = await service.createPurchaseOrders({
    id: `po_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    retailer_shop_id: auth.shop_id,
    supplier_shop_id: parsed.data.supplier_shop_id,
    supplier_id: supplierRecord?.id ?? null,
    status: "pending",
    items,
    subtotal_amount: Number(subtotal.toFixed(2)),
    total_amount: Number((subtotal + deliveryFee).toFixed(2)),
    notes: parsed.data.notes ?? null,
    delivery_method: parsed.data.delivery_method,
    delivery_fee: deliveryFee,
    delivery_status:
      parsed.data.delivery_method === "pickup" ? "scheduled" : "pending",
    payment_status: "pending",
    metadata: {
      supplier_name: supplierShop.shop_name ?? null,
    },
  } as Record<string, unknown>)

  const notifications = new NotificationService(req.scope)
  await notifications.sendNotification({
    shopId: parsed.data.supplier_shop_id,
    userType: "supplier",
    type: "new_order",
    title: "New wholesale order",
    message: `A retailer placed order ${String((created as Record<string, unknown>).id)}.`,
    data: { order_id: (created as Record<string, unknown>).id },
    channels: ["push", "sms", "in_app"],
  })
  await notifications.sendNotification({
    shopId: auth.shop_id,
    userType: "retailer",
    type: "new_order",
    title: "Order submitted",
    message: "Your supplier order has been submitted successfully.",
    data: { order_id: (created as Record<string, unknown>).id },
    channels: ["push", "in_app"],
  })

  res.status(201).json({
    success: true,
    order: shapePurchaseOrder(created as Record<string, unknown>),
  })
}
