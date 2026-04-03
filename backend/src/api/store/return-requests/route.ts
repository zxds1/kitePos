import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { RETURN_REQUEST_MODULE } from "../../../modules/return-request"
import type ReturnRequestModuleService from "../../../modules/return-request/service"
import {
  ReturnsService,
  generateReturnNumber,
  shapeReturnRequest,
} from "../../../services/returns.service"
import { ReturnItemSchema } from "../../pos/returns/_utils"
import { listNormalizedProducts } from "../../admin/products/_utils"

const CreateOnlineReturnSchema = z.object({
  shop_id: z.string().min(1),
  order_id: z.string().min(1),
  customer_name: z.string().min(1),
  customer_id: z.string().optional().nullable(),
  items: z.array(ReturnItemSchema).min(1),
  return_method: z.enum(["drop_off", "pickup"]).default("drop_off"),
  customer_notes: z.string().optional().nullable(),
})

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = CreateOnlineReturnSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid online return request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const requestService: ReturnRequestModuleService = req.scope.resolve(
    RETURN_REQUEST_MODULE
  )
  const returnsService = new ReturnsService(req.scope)
  const catalog = await listNormalizedProducts(req, {
    shopId: parsed.data.shop_id,
  })
  const productByVariant = new Map(catalog.map((product) => [product.variant_id, product]))

  for (const item of parsed.data.items) {
    const product = productByVariant.get(item.variant_id)
    if (!product) {
      res.status(404).json({
        success: false,
        message: `Product ${item.variant_id} not found for this shop`,
      })
      return
    }

    if (product.is_returnable === false) {
      res.status(400).json({
        success: false,
        message: `${item.product_name} is not eligible for online returns`,
      })
      return
    }
  }

  const items = parsed.data.items.map((item) => ({
    ...item,
    refund_amount:
      item.refund_amount ?? toNumber(item.unit_price) * toNumber(item.quantity, 1),
  }))
  const totalAmount = items.reduce(
    (sum, item) => sum + toNumber(item.refund_amount),
    0
  )

  const created = await requestService.createReturnRequests(
    returnsService.buildCreatePayload({
      shop_id: parsed.data.shop_id,
      customer_id: parsed.data.customer_id ?? null,
      return_type: "online_order",
      return_number: generateReturnNumber("WEB"),
      original_order_id: parsed.data.order_id,
      order_reference: parsed.data.order_id,
      customer_name: parsed.data.customer_name,
      items,
      total_amount: totalAmount,
      refund_amount: totalAmount,
      return_reason: String(items[0].reason),
      return_reason_category: items[0].reason_category,
      item_condition: items[0].condition,
      customer_notes: parsed.data.customer_notes ?? null,
      resolution: "original_payment",
      return_method: parsed.data.return_method,
      status: "pending",
    })
  )

  res.status(201).json({
    success: true,
    return_request: shapeReturnRequest(created as Record<string, unknown>),
  })
}
