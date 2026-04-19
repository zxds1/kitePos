import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { SHOP_MODULE } from "../../../../../modules/shop"
import type ShopModuleService from "../../../../../modules/shop/service"
import { getAuthorizedShop } from "../../../settings/_utils"
import { RAGRouterService } from "../../../../../services/rag-router.service"

const QuerySchema = z.object({
  query: z.string().trim().min(1),
  intent: z.string().trim().min(1).optional().nullable(),
  model: z.string().trim().min(1).optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = QuerySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid hybrid RAG query payload",
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

  const result = await new RAGRouterService(req.scope).routeQuery({
    query: parsed.data.query,
    shopId: auth.shop_id,
    shopName: String(shop.shop_name ?? "Storflo Shop"),
    intent: parsed.data.intent ?? undefined,
    model: parsed.data.model ?? undefined,
  })

  res.status(200).json({
    success: true,
    response: result.response,
    sources: result.sources,
    tokens_used: result.tokensUsed,
    cost_kes: result.costKes,
    rag_source: result.source,
    intent: result.intent,
  })
}
