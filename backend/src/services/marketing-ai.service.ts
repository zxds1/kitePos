import type { MedusaRequest } from "@medusajs/framework/http"
import { AIService } from "./ai.service"
import { listNormalizedProducts } from "../api/admin/products/_utils"

export class MarketingAIService {
  constructor(private readonly aiService: AIService) {}

  async getInsight(req: MedusaRequest, shopId: string, shopName: string) {
    const products = await listNormalizedProducts(req, { shopId })
    const featured = products
      .filter((product) => product.is_active)
      .slice(0, 3)
      .map((product) => product.name)

    const fallback = {
      sms: `Shop ${shopName}: fresh deals available today on ${featured.join(", ")}. Reply or visit our online store to order.`,
      whatsapp:
        `Karibu ${shopName}. We have new offers on ${featured.join(", ")} today. Visit our store link to browse and order.`,
    }

    return this.aiService.generateJson(
      {
        shopId,
        operationType: "marketing_content",
        prompt: `Create short JSON with keys "sms" and "whatsapp" for a Kenyan retail promotion for ${shopName}. Feature these products: ${featured.join(", ")}.`,
        maxTokens: 220,
        metadata: { featured_products: featured },
      },
      fallback
    )
  }
}
