import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { listNormalizedProducts } from "../../../admin/products/_utils"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { getAuthorizedShop } from "../../settings/_utils"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import { AIService } from "../../../../services/ai.service"
import { loadPrompt, renderPrompt } from "../../../../utils/prompt-loader"

const StoreBriefSchema = z.object({
  brief: z.record(z.any()).optional().default({}),
})

type BriefSuggestions = {
  summary: string
  suggested_theme: string
  suggested_slug: string
  suggestions: Record<string, string[]>
}

function normalizeSuggestionList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const normalized = value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)

  return normalized.length > 0 ? normalized.slice(0, 5) : fallback
}

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : fallback
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = StoreBriefSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid store brief payload",
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

  const products = await listNormalizedProducts(req, { shopId: auth.shop_id })
  const featuredProducts = products.slice(0, 8).map((product) => ({
    name: product.name,
    category: product.category,
    price: product.selling_units[0]?.["price"] ?? null,
  }))

  const brief = parsed.data.brief as Record<string, unknown>
  const aiService = new AIService(req.scope)
  const fallback: BriefSuggestions = {
    summary: `Use a secure, shareable storefront for ${text(shop.shop_name, "your shop")} with a clear hero, calm color language, and trusted checkout cues.`,
    suggested_theme: "smart-modern",
    suggested_slug: slugify(text(shop.shop_name, "store")),
    suggestions: {
      color_description: [
        "earthy green with cream and warm wood tones",
        "deep blue with clean white and soft sand",
        "soft black with gold accents and warm neutral surfaces",
      ],
      visual_style: [
        "clean retail editorial",
        "bold local commerce",
        "warm premium storefront",
      ],
      reference_style: [
        "closer to a clean premium boutique than a crowded marketplace",
        "practical like a trusted local dukashop, but with a polished finish",
        "simple and fast like a mobile-first store page",
      ],
      reference_stores: [
        "a clean premium boutique storefront",
        "a simple local duka website with fast checkout",
        "a polished mobile-first catalog page",
      ],
      content_priorities: [
        "what the shop sells",
        "why customers should trust it",
        "how customers order fast",
      ],
      hero_direction: [
        "show the best products first with a direct order CTA",
        "lead with trust, speed, and local fulfilment",
        "center the shop story and everyday essentials",
      ],
      section_stack: [
        "featured products",
        "why shop here",
        "delivery and payment",
        "returns and contact",
      ],
      trust_signals: [
        "visible business contact",
        "clear delivery promise",
        "simple returns policy",
      ],
      security_notes: [
        "secure checkout only",
        "no custom scripts or embedded tracking",
        "HTTPS-only links and media",
      ],
      seo_keywords: [
        "online shop",
        "local delivery",
        "M-Pesa checkout",
      ],
      cta_style: [
        "Order on WhatsApp",
        "Browse the catalog",
        "Reserve stock now",
      ],
    },
  }

  const extracted = await aiService.generateJson<BriefSuggestions>(
    {
      shopId: auth.shop_id,
      operationType: "store_brief_suggestions",
      model: undefined,
      maxTokens: 260,
      temperature: 0.25,
      systemPrompt: loadPrompt(
        "ai/shop-assistant-store-draft.md",
        [
          "Return a structured storefront brief with safe defaults.",
          "Use natural language color descriptions, reference styles, and practical storefront suggestions.",
        ].join(" ")
      ),
      prompt: renderPrompt(
        [
          "Shop name: {{shop_name}}",
          "Shop summary: {{shop_summary}}",
          "Current brief: {{brief_json}}",
          "Featured products: {{featured_products_json}}",
          "If the brief mentions reference stores or content priorities, keep them specific and practical.",
          "Suggest a concise summary and a few options for the store owner to choose from.",
          "Keep the options concrete, specific, and easy for a real shop owner to approve or reject.",
          "Return JSON only.",
        ].join("\n"),
        {
          shop_name: text(shop.shop_name, "Store"),
          shop_summary: text(shop.category, "Retail shop"),
          brief_json: JSON.stringify(brief),
          featured_products_json: JSON.stringify(featuredProducts),
        }
      ),
    },
    fallback
  )

  const suggestions = {
    summary: text(extracted.summary, fallback.summary),
    suggested_theme: text(extracted.suggested_theme, fallback.suggested_theme),
    suggested_slug: text(extracted.suggested_slug, fallback.suggested_slug),
    suggestions: {
      color_description: normalizeSuggestionList(
        extracted.suggestions?.color_description,
        fallback.suggestions.color_description
      ),
      visual_style: normalizeSuggestionList(
        extracted.suggestions?.visual_style,
        fallback.suggestions.visual_style
      ),
      reference_style: normalizeSuggestionList(
        extracted.suggestions?.reference_style,
        fallback.suggestions.reference_style
      ),
      reference_stores: normalizeSuggestionList(
        extracted.suggestions?.reference_stores,
        fallback.suggestions.reference_stores
      ),
      content_priorities: normalizeSuggestionList(
        extracted.suggestions?.content_priorities,
        fallback.suggestions.content_priorities
      ),
      hero_direction: normalizeSuggestionList(
        extracted.suggestions?.hero_direction,
        fallback.suggestions.hero_direction
      ),
      section_stack: normalizeSuggestionList(
        extracted.suggestions?.section_stack,
        fallback.suggestions.section_stack
      ),
      trust_signals: normalizeSuggestionList(
        extracted.suggestions?.trust_signals,
        fallback.suggestions.trust_signals
      ),
      security_notes: normalizeSuggestionList(
        extracted.suggestions?.security_notes,
        fallback.suggestions.security_notes
      ),
      seo_keywords: normalizeSuggestionList(
        extracted.suggestions?.seo_keywords,
        fallback.suggestions.seo_keywords
      ),
      cta_style: normalizeSuggestionList(
        extracted.suggestions?.cta_style,
        fallback.suggestions.cta_style
      ),
    },
  }

  res.status(200).json({
    success: true,
    ...suggestions,
  })
}
