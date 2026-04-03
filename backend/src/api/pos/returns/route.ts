import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { canManageBranches } from "../../auth/_utils/shop-users"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import { NotificationService } from "../../../services/notification.service"
import {
  ReturnsService,
  generateReturnNumber,
  normalizeB2BReturnPolicy,
  normalizeReturnPolicy,
  shapeReturnRequest,
} from "../../../services/returns.service"
import {
  RefundMethodSchema,
  ReturnItemConditionSchema,
  ReturnItemSchema,
  ReturnMethodSchema,
  ReturnReasonCategorySchema,
} from "./_utils"

const CreateReturnSchema = z.object({
  return_type: z
    .enum(["b2c_customer", "b2b_retailer", "online_order", "manual"])
    .default("manual"),
  supplier_shop_id: z.string().optional().nullable(),
  sale_snapshot_id: z.string().optional().nullable(),
  original_sale_id: z.string().optional().nullable(),
  original_order_id: z.string().optional().nullable(),
  order_reference: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_id: z.string().optional().nullable(),
  items: z.array(ReturnItemSchema).min(1).optional(),
  item_name: z.string().optional(),
  reason: z.string().optional(),
  reason_category: ReturnReasonCategorySchema.optional(),
  condition: ReturnItemConditionSchema.optional(),
  amount: z.coerce.number().min(0).optional(),
  refund_amount: z.coerce.number().min(0).optional().nullable(),
  restocking_fee: z.coerce.number().min(0).optional().nullable(),
  resolution: RefundMethodSchema.or(
    z.enum(["exchange"])
  ).default("store_credit"),
  return_method: ReturnMethodSchema.default("drop_off"),
  customer_notes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function getShop(
  service: ShopModuleService,
  shopId: string
): Promise<Record<string, unknown> | null> {
  const [shops] = await service.listAndCountShops({ id: shopId }, { take: 1 })
  return (shops[0] as Record<string, unknown> | undefined) ?? null
}

function buildItemsFromLegacyInput(data: z.infer<typeof CreateReturnSchema>) {
  if (data.items?.length) {
    return data.items.map((item) => {
      const refundAmount =
        item.refund_amount ?? toNumber(item.unit_price) * toNumber(item.quantity, 1)
      return {
        ...item,
        refund_amount: refundAmount,
      }
    })
  }

  return [
    {
      variant_id: `manual_${randomUUID().slice(0, 8)}`,
      product_name: data.item_name ?? "Return item",
      quantity: 1,
      reason: data.reason ?? "Manual return",
      reason_category: data.reason_category ?? "other",
      condition: data.condition ?? "new",
      photo_urls: [],
      refund_amount: data.amount ?? 0,
    },
  ]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: ReturnRequestModuleService = req.scope.resolve(RETURN_REQUEST_MODULE)
  const scope = typeof req.query.scope === "string" ? req.query.scope : "shop"
  const status = typeof req.query.status === "string" ? req.query.status : null

  const filters: Record<string, unknown> =
    scope === "supplier"
      ? { supplier_shop_id: auth.shop_id }
      : scope === "all"
        ? {}
        : { shop_id: auth.shop_id }

  if (status) {
    filters.status = status
  }

  const [requests] = await service.listAndCountReturnRequests(filters, {
    take: 200,
    order: { requested_at: "DESC" },
  })

  const shaped = (requests as Array<Record<string, unknown>>)
    .filter((entry) => {
      if (scope === "all") {
        return (
          String(entry.shop_id ?? "") === auth.shop_id ||
          String(entry.supplier_shop_id ?? "") === auth.shop_id
        )
      }
      return true
    })
    .map(shapeReturnRequest)

  res.status(200).json({
    success: true,
    returns: shaped,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = CreateReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid return payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const returnService = new ReturnsService(req.scope)
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const requestService: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE
  )

  const sourceShop = await getShop(shopService, auth.shop_id)
  if (!sourceShop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const items = buildItemsFromLegacyInput(parsed.data)
  const firstItem = items[0]
  const totalAmount = items.reduce(
    (sum, item) => sum + toNumber(item.refund_amount),
    parsed.data.amount ?? 0
  )

  const isB2B = parsed.data.return_type === "b2b_retailer"
  const policy = isB2B
    ? normalizeB2BReturnPolicy(sourceShop.b2b_return_policy)
    : normalizeReturnPolicy(sourceShop.return_policy)

  if (!policy.accepts_returns) {
    res.status(400).json({
      success: false,
      message: isB2B
        ? "B2B returns are disabled for this shop"
        : "Returns are disabled for this shop",
    })
    return
  }

  const restockingFee =
    parsed.data.restocking_fee ??
    Number((totalAmount * (policy.restocking_fee_percent / 100)).toFixed(2))
  const refundAmount =
    parsed.data.refund_amount ?? Math.max(0, totalAmount - restockingFee)
  const fraud = await returnService.calculateFraudScore({
    shopId: auth.shop_id,
    customerId: parsed.data.customer_id ?? null,
    items,
  })

  const autoApprove =
    fraud.score < 20 &&
    items.every((item) =>
      ["defective", "expired", "wrong_item"].includes(String(item.reason_category))
    ) &&
    !isB2B

  const created = await requestService.createReturnRequests(
    returnService.buildCreatePayload({
      shop_id: auth.shop_id,
      supplier_shop_id: parsed.data.supplier_shop_id ?? null,
      customer_id: parsed.data.customer_id ?? null,
      return_type: parsed.data.return_type,
      return_number: generateReturnNumber(
        isB2B
          ? "B2B"
          : parsed.data.return_type === "online_order"
            ? "WEB"
            : "B2C"
      ),
      original_sale_id: parsed.data.original_sale_id ?? null,
      original_order_id: parsed.data.original_order_id ?? null,
      sale_snapshot_id: parsed.data.sale_snapshot_id ?? null,
      order_reference: parsed.data.order_reference ?? null,
      customer_name: parsed.data.customer_name ?? null,
      items,
      total_amount: totalAmount,
      refund_amount: refundAmount,
      restocking_fee: restockingFee,
      return_reason: String(firstItem.reason),
      return_reason_category: firstItem.reason_category,
      item_condition: firstItem.condition,
      customer_notes: parsed.data.customer_notes ?? null,
      notes: parsed.data.notes ?? null,
      resolution: parsed.data.resolution,
      return_method: parsed.data.return_method,
      status: autoApprove ? "approved" : "pending",
      created_by: auth.user_id ?? null,
      fraud_score: fraud.score,
      fraud_flags: fraud.flags,
    })
  )

  const notifications = new NotificationService(req.scope)
  if (isB2B && parsed.data.supplier_shop_id) {
    await notifications.sendNotification({
      shopId: parsed.data.supplier_shop_id,
      userType: "supplier",
      type: "b2b_return_request",
      title: "New B2B return request",
      message: `A retailer requested return ${String((created as Record<string, unknown>).return_number)}.`,
      data: { return_id: (created as Record<string, unknown>).id },
      channels: ["push", "sms", "in_app"],
    })
  } else if (!autoApprove) {
    await notifications.sendNotification({
      shopId: auth.shop_id,
      userType: "retailer",
      type: "new_return_request",
      title: "New return request",
      message: `Return ${String((created as Record<string, unknown>).return_number)} is awaiting review.`,
      data: { return_id: (created as Record<string, unknown>).id },
      channels: ["push", "in_app"],
    })
  }

  res.status(201).json({
    success: true,
    return_request: shapeReturnRequest(created as Record<string, unknown>),
  })
}
