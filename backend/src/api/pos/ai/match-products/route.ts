import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import ProductMatchingService from "../../../../services/ProductMatchingService"
import { listNormalizedProducts } from "../../../../api/admin/products/_utils"

const MatchProductsSchema = z.object({
  extracted_items: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        quantity: z.number().int().min(1),
        confidence: z.number().min(0).max(1),
      })
    )
    .min(1)
    .max(100),
  min_similarity: z.number().min(0).max(100).default(80).optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = MatchProductsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid product matching request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const { extracted_items, min_similarity } = parsed.data
  const logger: any = req.scope.resolve("logger")

  try {
    // Get all products for this shop
    const normalizedProducts = await listNormalizedProducts(req, {
      shopId: auth.shop_id,
    })

    if (!normalizedProducts || normalizedProducts.length === 0) {
      logger.warn(`No products found for shop ${auth.shop_id}`)
      res.status(200).json({
        success: true,
        matches: extracted_items.map((item) => ({
          extracted_name: item.name,
          match: null,
          alternatives: [],
          confidence: "low",
          quantity: item.quantity,
          extraction_confidence: item.confidence,
        })),
        match_quality: 0,
        shop_id: auth.shop_id,
      })
      return
    }

    // Format products for matching
    const formattedProducts = normalizedProducts.map((product) => ({
      id: product.id,
      variantId: product.variant_id,
      name: product.name,
      category: product.category ?? undefined,
      price: undefined,
      unit: product.purchase_unit ?? "piece",
    }))

    // Run matching service
    const matchingService = new ProductMatchingService()
    const matchResults = matchingService.findMatches(
      extracted_items.map((item) => item.name),
      formattedProducts,
      min_similarity ?? 80
    )

    const matchQuality = matchingService.getMatchQuality(matchResults)

    // Enrich results with quantity and extraction confidence
    const enrichedResults = matchResults.map((result, index) => ({
      ...result,
      quantity: extracted_items[index].quantity,
      extraction_confidence: extracted_items[index].confidence,
    }))

    logger.info(
      `Matched ${enrichedResults.filter((r) => r.match).length}/${extracted_items.length} items for shop ${auth.shop_id}`
    )

    res.status(200).json({
      success: true,
      matches: enrichedResults,
      match_quality: matchQuality,
      shop_id: auth.shop_id,
    })
  } catch (error: any) {
    logger.error(`Product matching failed for shop ${auth.shop_id}: ${error.message}`)

    res.status(500).json({
      success: false,
      message: error.message || "Failed to match products",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  res.status(200).json({
    success: true,
    message: "Product matching service ready",
    min_similarity_default: 80,
    shop_id: auth.shop_id,
  })
}
