import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { resolveStorefront } from "../../_storefront"
import { RAGRouterService } from "../../../../services/rag-router.service"

const AssistantPayload = z.object({
  query: z.string().trim().min(1),
  actor: z.enum(["buyer", "seller"]).default("buyer"),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = AssistantPayload.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid assistant payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const storefront = await resolveStorefront(req, {
    slug: req.params.slug,
    host: req.headers.host,
  })

  if (!storefront) {
    res.status(404).json({
      success: false,
      message: "Storefront not found",
    })
    return
  }

  const actorPrefix =
    parsed.data.actor === "seller"
      ? "Seller operations question: "
      : "Buyer shopping question: "

  const result = await new RAGRouterService(req.scope).routeQuery({
    query: `${actorPrefix}${parsed.data.query}`,
    shopId: String(storefront.shop.id ?? ""),
    shopName: String(storefront.shop.shop_name ?? "Trace Shop"),
  })

  res.status(200).json({
    success: true,
    response: result.response,
    sources: result.sources,
    rag_source: result.source,
    intent: result.intent,
  })
}
