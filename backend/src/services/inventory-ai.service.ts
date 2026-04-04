import type { MedusaRequest } from "@medusajs/framework/http"
import { listNormalizedProducts } from "../api/admin/products/_utils"

export class InventoryAIService {
  async getInsights(req: MedusaRequest, shopId: string) {
    const products = await listNormalizedProducts(req, { shopId })
    const lowStock = products
      .filter((product) => {
        const threshold = product.low_stock_threshold ?? 10
        return product.is_active && product.stock_remaining <= threshold
      })
      .sort((a, b) => a.stock_remaining - b.stock_remaining)
      .slice(0, 5)

    return lowStock.map((product) => ({
      variant_id: product.variant_id,
      product_name: product.name,
      stock_remaining: product.stock_remaining,
      threshold: product.low_stock_threshold ?? 10,
      suggestion: `Restock ${product.name}. Remaining stock is ${product.stock_remaining}, below the threshold of ${product.low_stock_threshold ?? 10}.`,
      urgency:
        product.stock_remaining <= Math.max((product.low_stock_threshold ?? 10) / 2, 2)
          ? "high"
          : "medium",
    }))
  }
}
