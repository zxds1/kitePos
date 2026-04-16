import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import AIExtractionService from "../../../../services/AIExtractionService"
import ProductMatchingService from "../../../../services/ProductMatchingService"
import VisualMatchingService from "../../../../services/VisualMatchingService"
import { listNormalizedProducts } from "../../../../api/admin/products/_utils"

const HybridMatchSchema = z.object({
  image_base64: z
    .string()
    .min(1)
    .max(10_000_000, "Image must be 10MB or smaller before encoding"),
  mode: z.enum(["receipt", "product"], {
    errorMap: () => ({
      message: "mode must be 'receipt' or 'product'",
    }),
  }),
  file_name: z.string().min(1).max(255).optional().nullable(),
  min_text_similarity: z.number().min(0).max(100).default(80).optional(),
  min_combined_similarity: z.number().min(0).max(100).default(70).optional(),
})

interface HybridMatch {
  extracted_name: string
  quantity: number
  extraction_confidence: number

  // Text-based matching
  text_match: {
    product_id?: string
    variant_id?: string
    name?: string
    similarity: number
    confidence: "high" | "medium" | "low"
  }

  // Visual matching
  visual_match: {
    product_id?: string
    variant_id?: string
    name?: string
    similarity: number
    confidence: "high" | "medium" | "low"
    reason?: string
  }

  // Combined result
  final_match: {
    product_id?: string
    variant_id?: string
    name?: string
    combined_score: number
    text_weight: number
    visual_weight: number
    recommendation: "high_confidence" | "medium_confidence" | "needs_verification"
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = HybridMatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid hybrid match request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const { image_base64, mode, min_text_similarity, min_combined_similarity } =
    parsed.data
  const logger: any = req.scope.resolve("logger")

  try {
    // Validate base64
    const sanitizedBase64 = image_base64.replace(/\s+/g, "")
    const buffer = Buffer.from(sanitizedBase64, "base64")

    if (buffer.length <= 0 || buffer.length > 7 * 1024 * 1024) {
      res.status(413).json({
        success: false,
        message: "Image must be between 1 byte and 7MB",
      })
      return
    }

    // Step 1: Extract text from image
    const extractionService = new AIExtractionService(req.scope)
    const extraction = await extractionService.extractSalesFromImage(
      sanitizedBase64,
      mode
    )

    if (extraction.items.length === 0) {
      res.status(200).json({
        success: true,
        extraction,
        matches: [],
        extraction_quality: 0,
        match_quality: 0,
        shop_id: auth.shop_id,
      })
      return
    }

    // Step 2: Get shop products
    const normalizedProducts = await listNormalizedProducts(req, {
      shopId: auth.shop_id,
    })

    if (!normalizedProducts || normalizedProducts.length === 0) {
      logger.warn(`No products found for shop ${auth.shop_id}`)
      res.status(200).json({
        success: true,
        extraction,
        matches: extraction.items.map((item) => ({
          extracted_name: item.name,
          quantity: item.quantity,
          extraction_confidence: item.confidence,
          text_match: {
            similarity: 0,
            confidence: "low",
          },
          visual_match: {
            similarity: 0,
            confidence: "low",
          },
          final_match: {
            combined_score: 0,
            text_weight: 0.5,
            visual_weight: 0.5,
            recommendation: "needs_verification",
          },
        })),
        extraction_quality: extraction.confidence_average * 100,
        match_quality: 0,
        shop_id: auth.shop_id,
      })
      return
    }

    // Format products
    const formattedProducts = normalizedProducts.map((product) => ({
      id: product.id,
      variantId: product.variant_id,
      name: product.name,
      category: product.category ?? undefined,
      imageUrl: product.image_url ?? undefined,
    }))

    // Step 3: Text-based matching
    const textMatchingService = new ProductMatchingService()
    const textMatches = textMatchingService.findMatches(
      extraction.items.map((item) => item.name),
      formattedProducts,
      min_text_similarity ?? 80
    )

    // Step 4: Visual matching (only supported for product photos)
    const visualMatchingService = new VisualMatchingService(req.scope)
    const visualMatches =
      mode === "product"
        ? await visualMatchingService.findVisualMatches(
            sanitizedBase64,
            formattedProducts,
            5 // Top 5 visual matches
          )
        : []

    const topVisualMatch = visualMatches[0]

    // Step 5: Combine results
    const hybridMatches: HybridMatch[] = extraction.items.map((item, index) => {
      const textMatch = textMatches[index]
      const visualMatch = mode === "product" ? topVisualMatch : undefined

      // Calculate combined score (60% text, 40% visual)
      const textScore = textMatch.match?.similarity ?? 0
      const visualScore = visualMatch?.visual_similarity ?? 0
      const combinedScore = textScore * 0.6 + visualScore * 0.4

      // Determine recommendation
      let recommendation: "high_confidence" | "medium_confidence" | "needs_verification" =
        "needs_verification"
      if (combinedScore >= 85 && textScore >= 80 && visualScore >= 75) {
        recommendation = "high_confidence"
      } else if (combinedScore >= 70) {
        recommendation = "medium_confidence"
      }

      return {
        extracted_name: item.name,
        quantity: item.quantity,
        extraction_confidence: item.confidence,
        text_match: {
          product_id: textMatch.match?.product_id,
          variant_id: textMatch.match?.variant_id,
          name: textMatch.match?.name,
          similarity: textMatch.match?.similarity ?? 0,
          confidence: textMatch.confidence,
        },
        visual_match: {
          product_id: visualMatch?.product_id,
          variant_id: visualMatch?.variant_id,
          name: visualMatch?.product_name,
          similarity: visualMatch?.visual_similarity ?? 0,
          confidence: visualMatch?.confidence ?? "low",
          reason:
            visualMatch?.match_reason ??
            (mode === "receipt"
              ? "Visual matching not supported for receipt images"
              : undefined),
        },
        final_match: {
          product_id:
            combinedScore >= (min_combined_similarity ?? 70)
              ? textMatch.match?.product_id || visualMatch?.product_id
              : undefined,
          variant_id:
            combinedScore >= (min_combined_similarity ?? 70)
              ? textMatch.match?.variant_id || visualMatch?.variant_id
              : undefined,
          name:
            combinedScore >= (min_combined_similarity ?? 70)
              ? textMatch.match?.name || visualMatch?.product_name
              : undefined,
          combined_score: Math.round(combinedScore),
          text_weight: 60,
          visual_weight: 40,
          recommendation,
        },
      }
    })

    const matchedCount = hybridMatches.filter(
      (m) => m.final_match.product_id
    ).length
    const matchQuality = Math.round((matchedCount / hybridMatches.length) * 100)

    logger.info(
      `Hybrid matched ${matchedCount}/${hybridMatches.length} items for shop ${auth.shop_id}`
    )

    res.status(200).json({
      success: true,
      extraction,
      matches: hybridMatches,
      extraction_quality: Math.round(extraction.confidence_average * 100),
      match_quality: matchQuality,
      shop_id: auth.shop_id,
    })
  } catch (error: any) {
    logger.error(`Hybrid matching failed for shop ${auth.shop_id}: ${error.message}`)

    res.status(500).json({
      success: false,
      message: error.message || "Failed to perform hybrid matching",
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
    message: "Hybrid matching service ready (text + visual)",
    features: {
      extraction: "LLM-based product name extraction from photos",
      text_matching: "Fuzzy string matching against inventory (80%+ similarity)",
      visual_matching: "LLM visual image comparison against product photos",
      hybrid_scoring: "Combined text (60%) + visual (40%) scoring",
    },
    defaults: {
      min_text_similarity: 80,
      min_combined_similarity: 70,
    },
    shop_id: auth.shop_id,
  })
}
