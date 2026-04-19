import type { MedusaContainer } from "@medusajs/framework"

type ExtractionMode = "receipt" | "product" | "backfill"

interface ExtractedItem {
  name: string
  quantity: number
  confidence: number
}

export interface SalesExtractionResult {
  items: ExtractedItem[]
  raw_extraction: string
  extraction_mode: ExtractionMode
  model_used: string
  confidence_average: number
  timestamp: string
}

const DEFAULT_LLM_MODEL = process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini"

const RECEIPT_EXTRACTION_PROMPT = `You are an expert at reading sales receipts and handwritten invoices. 
Extract the list of items sold with their quantities. Return ONLY a JSON array with items in this format:
[
  {"name": "Product Name", "quantity": 2},
  {"name": "Another Item", "quantity": 1}
]

If the receipt is unclear or partially illegible, make your best estimate and include low-confidence items.
Return ONLY valid JSON, no other text.`

const PRODUCT_PHOTO_EXTRACTION_PROMPT = `You are an expert at identifying products in photographs and estimating quantities.
Look at the image and extract the visible items with their estimated quantities. Return ONLY a JSON array:
[
  {"name": "Product Name", "quantity": 5},
  {"name": "Another Item", "quantity": 3}
]

For items visible multiple times, sum the quantities. Make reasonable estimates for visibility.
Return ONLY valid JSON, no other text.`

const BACKFILL_EXTRACTION_PROMPT = `You are an expert at reading handwritten or printed sales backfill records.
Extract the sold items and their quantities as faithfully as possible from the page, note, or book image. Return ONLY a JSON array:
[
  {"name": "Product Name", "quantity": 2},
  {"name": "Another Item", "quantity": 1}
]

If the record is unclear, preserve the most likely item names and quantities without inventing extra items.
Return ONLY valid JSON, no other text.`

export class AIExtractionService {
  private container: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container = container
  }

  async extractSalesFromImage(
    imageBase64: string,
    mode: ExtractionMode
  ): Promise<SalesExtractionResult> {
    const logger = this.container.resolve("logger")

    try {
      const systemPrompt =
        mode === "receipt"
          ? RECEIPT_EXTRACTION_PROMPT
          : mode === "backfill"
            ? BACKFILL_EXTRACTION_PROMPT
            : PRODUCT_PHOTO_EXTRACTION_PROMPT

      // Use LiteeLLM client to call vision-capable models
      const response = await this.callLLMVision(imageBase64, systemPrompt)

      // Parse the response
      let items: ExtractedItem[] = []
      let rawText = response

      try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          items = Array.isArray(parsed)
            ? parsed.map((item: any) => ({
                name: String(item.name || "").trim(),
                quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
                confidence: this.calculateConfidence(
                  item.confidence ?? 0.85,
                  String(item.name || "").length
                ),
              }))
            : []
        }
      } catch (e) {
        logger.warn(`Failed to parse extraction JSON: ${e}`)
      }

      // Filter out empty items
      items = items.filter((item) => item.name.length > 0)

      if (items.length === 0) {
        logger.warn(`No items extracted from ${mode} image`)
        return {
          items: [],
          raw_extraction: response,
          extraction_mode: mode,
          model_used: DEFAULT_LLM_MODEL,
          confidence_average: 0,
          timestamp: new Date().toISOString(),
        }
      }

      const confidenceAverage =
        items.reduce((sum, item) => sum + item.confidence, 0) / items.length

      return {
        items,
        raw_extraction: response,
        extraction_mode: mode,
        model_used: DEFAULT_LLM_MODEL,
        confidence_average: confidenceAverage,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`AI extraction error: ${message}`)
      throw new Error(`Failed to extract sales data from image: ${message}`)
    }
  }

  private async callLLMVision(imageBase64: string, systemPrompt: string): Promise<string> {
    const logger = this.container.resolve("logger")

    // Check if we have a LiteeLLM client or need to call via HTTP
    // For now, we'll use fetch to call a local/remote LiteeLLM server
    const liteLLMBaseUrl = process.env.LITELLM_BASE_URL || "http://localhost:4000"
    const liteLLMApiKey = process.env.LITELLM_API_KEY ?? process.env.LITELLM_MASTER_KEY

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (liteLLMApiKey) {
        headers.Authorization = `Bearer ${liteLLMApiKey}`
      }

      const response = await fetch(`${liteLLMBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: DEFAULT_LLM_MODEL,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract the items and quantities from this image as JSON.",
                },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        let message = body
        try {
          const errorData = JSON.parse(body)
          message = errorData.message || errorData.error || body
        } catch {
          /* ignore parse error */
        }
        throw new Error(`LiteeLLM error: ${message}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content?.trim()

      if (!content) {
        throw new Error("No response content from LiteeLLM")
      }

      logger.info(`LiteeLLM extraction successful for image`)
      return content
    } catch (error) {
      logger.error(`LiteeLLM vision call failed: ${error}`)
      throw error
    }
  }

  private calculateConfidence(baseConfidence: number, nameLength: number): number {
    // Longer product names are typically more confident extractions
    const lengthBonus = Math.min(0.15, nameLength * 0.01)
    const confidence = Math.min(1, baseConfidence + lengthBonus)
    return Math.round(confidence * 100) / 100
  }
}

export default AIExtractionService
