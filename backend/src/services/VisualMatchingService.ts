import type { MedusaContainer } from "@medusajs/framework"

const DEFAULT_LLM_MODEL = process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini"

export interface VisualMatchResult {
  product_id: string
  variant_id: string
  product_name: string
  visual_similarity: number // 0-100%
  match_reason: string // Why this is a match
  confidence: "high" | "medium" | "low"
}

export class VisualMatchingService {
  private container: MedusaContainer

  constructor(container: MedusaContainer) {
    this.container = container
  }

  /**
   * Compare uploaded product photo against shop product photos
   * Uses LiteeLLM vision to analyze both images and score similarity
   */
  async findVisualMatches(
    uploadedImageBase64: string,
    products: Array<{
      id: string
      variantId: string
      name: string
      imageUrl?: string
    }>,
    topN: number = 3
  ): Promise<VisualMatchResult[]> {
    const logger = this.container.resolve("logger")

    try {
      // Filter products that have images
      const productsWithImages = products.filter((p) => p.imageUrl)

      if (productsWithImages.length === 0) {
        logger.warn(`No products with images available for visual matching`)
        return []
      }

      // Score uploaded image against each product image
      const scores: VisualMatchResult[] = []

      for (const product of productsWithImages.slice(0, 50)) {
        // Limit to 50 products to avoid too many API calls
        try {
          const similarity = await this.compareImages(
            uploadedImageBase64,
            product.imageUrl!
          )

          if (similarity > 0) {
            scores.push({
              product_id: product.id,
              variant_id: product.variantId,
              product_name: product.name,
              visual_similarity: similarity,
              match_reason: this.getMatchReason(similarity, product.name),
              confidence: this.getConfidenceLevel(similarity),
            })
          }
        } catch (e) {
          logger.warn(
            `Failed to compare with product ${product.id}: ${e}`
          )
          // Continue with next product
        }
      }

      // Sort by similarity descending
      scores.sort((a, b) => b.visual_similarity - a.visual_similarity)

      return scores.slice(0, topN)
    } catch (error) {
      logger.error(`Visual matching error: ${error}`)
      return []
    }
  }

  /**
   * Compare two images using LiteeLLM vision
   * Returns similarity score 0-100%
   */
  private async compareImages(
    uploadedBase64: string,
    databaseImageUrl: string
  ): Promise<number> {
    const logger = this.container.resolve("logger")
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
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are comparing two product photos. Score how similar they are on a scale of 0-100. 
Return ONLY a JSON object with a single number field "similarity" (0-100).
Consider: same product type, color, style, fit. Ignore background and angles.

Examples:
- Two identical t-shirts in different colors = 75
- Same product, same color, different angle = 90
- Same product type (t-shirt vs t-shirt variation) = 70
- Different product types (t-shirt vs jeans) = 20

Return only valid JSON.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${uploadedBase64}`,
                  },
                },
                {
                  type: "text",
                  text: "First image (customer upload). Second is database product:",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: databaseImageUrl,
                  },
                },
              ],
            },
          ],
          temperature: 0.1, // Low temperature for consistency
          max_tokens: 100,
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
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error("No response from LiteeLLM")
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.warn(`Failed to extract JSON from visual comparison: ${content}`)
        return 0
      }

      const parsed = JSON.parse(jsonMatch[0])
      const similarity = Math.min(100, Math.max(0, parsed.similarity ?? 0))

      logger.debug(`Visual similarity score: ${similarity}`)
      return similarity
    } catch (error) {
      logger.error(`Image comparison failed: ${error}`)
      return 0
    }
  }

  /**
   * Determine confidence level based on visual similarity
   */
  private getConfidenceLevel(similarity: number): "high" | "medium" | "low" {
    if (similarity >= 80) return "high"
    if (similarity >= 65) return "medium"
    return "low"
  }

  /**
   * Generate human-readable match reason
   */
  private getMatchReason(similarity: number, productName: string): string {
    if (similarity >= 90) {
      return `Very similar to ${productName} (${similarity}%)`
    } else if (similarity >= 75) {
      return `Likely ${productName} (${similarity}%)`
    } else if (similarity >= 60) {
      return `Could be ${productName} (${similarity}%), verify visually`
    } else {
      return `Weak visual match (${similarity}%)`
    }
  }

  /**
   * Describes what the uploaded image contains
   * Useful for debugging and providing feedback to seller
   */
  async describeImage(imageBase64: string): Promise<string> {
    const logger = this.container.resolve("logger")
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
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Briefly describe what clothing/product is visible in this image in 1-2 sentences.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: 100,
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
        throw new Error(`Failed to describe image: ${message}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content ?? "Unable to describe image"
    } catch (error) {
      logger.error(`Image description failed: ${error}`)
      return "Unable to describe image"
    }
  }
}

export default VisualMatchingService
