import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import AIExtractionService from "../../../../services/AIExtractionService"

const ExtractionSchema = z.object({
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
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = ExtractionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid extraction request",
      errors: parsed.error.flatten(),
    })
    return
  }

  const { image_base64, mode } = parsed.data
  const logger: any = req.scope.resolve("logger")

  try {
    // Validate base64 format
    const sanitizedBase64 = image_base64.replace(/\s+/g, "")
    const buffer = Buffer.from(sanitizedBase64, "base64")

    if (buffer.length <= 0) {
      res.status(400).json({
        success: false,
        message: "Image payload is empty",
      })
      return
    }

    if (buffer.length > 7 * 1024 * 1024) {
      // 7MB before encoding (allows some overhead)
      res.status(413).json({
        success: false,
        message: "Image must be 7MB or smaller",
      })
      return
    }

    // Create extraction service and process image
    const extractionService = new AIExtractionService(req.scope)
    const result = await extractionService.extractSalesFromImage(sanitizedBase64, mode)

    // Return extraction result
    res.status(200).json({
      success: true,
      extraction: {
        items: result.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          confidence: item.confidence,
        })),
        mode: result.extraction_mode,
        confidence_average: result.confidence_average,
        model_used: result.model_used,
        timestamp: result.timestamp,
        raw_extraction:
          process.env.NODE_ENV !== "production"
            ? result.raw_extraction
            : undefined,
      },
      shop_id: auth.shop_id,
    })
  } catch (error: any) {
    logger.error(
      `Sales extraction failed for shop ${auth.shop_id}: ${error.message}`
    )

    const statusCode = error.message?.includes("10MB") ? 413 : 500
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to extract sales data from image",
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
    message: "Sales image extraction endpoint ready",
    supported_modes: ["receipt", "product"],
    max_image_size_mb: 7,
    shop_id: auth.shop_id,
  })
}
