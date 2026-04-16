import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import { getAuthorizedShop } from "../../settings/_utils"
import { z } from "zod"
import {
  ShopAssistantService,
  type AssistantConfirmedAction,
} from "../../../../services/shop-assistant.service"

const ToolRequestSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum(["create_product", "create_restock", "adjust_stock"]),
  title: z.string().trim().min(1).optional().default(""),
  summary: z.string().trim().min(1).optional().default(""),
  payload: z.record(z.string(), z.unknown()).default({}),
  confirm_label: z.string().trim().min(1).optional().default("Confirm"),
  cancel_label: z.string().trim().min(1).optional().default("Cancel"),
})

const AssistantSchema = z.object({
  query: z.string().trim().min(1),
  model: z.string().trim().min(1).optional().nullable(),
  confirmed_action: ToolRequestSchema.optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = AssistantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid assistant payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shop = await getAuthorizedShop(shopService, auth.shop_id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const assistant = new ShopAssistantService(req)
  const result = await assistant.run({
    shopId: auth.shop_id,
    shopName: String(shop.shop_name ?? "Trace Shop"),
    query: parsed.data.query,
    model: parsed.data.model ?? undefined,
    confirmedAction:
      parsed.data.confirmed_action == null
        ? null
        : (parsed.data.confirmed_action as AssistantConfirmedAction),
  })

  res.status(200).json({
    success: true,
    task: result.task,
    response: result.response,
    actions: result.actions,
    data: result.data,
    tool_request: result.tool_request ?? null,
    requires_confirmation: result.requires_confirmation ?? false,
  })
}
