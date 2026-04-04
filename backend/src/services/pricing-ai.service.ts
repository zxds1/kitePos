import type { MedusaRequest } from "@medusajs/framework/http"
import { listNormalizedProducts } from "../api/admin/products/_utils"

export class PricingAIService {
  async getInsights(req: MedusaRequest, shopId: string) {
    const products = await listNormalizedProducts(req, { shopId })

    return products
      .filter(
        (product) =>
          product.is_active &&
          Array.isArray(product.selling_units) &&
          product.selling_units.length > 0
      )
      .slice(0, 5)
      .map((product) => {
        const firstUnit = product.selling_units[0] ?? {}
        const currentPrice = asNum(firstUnit["price"])
        const recommendation =
          product.stock_remaining <= (product.low_stock_threshold ?? 10)
            ? currentPrice * 1.03
            : currentPrice * 0.98
        return {
          variant_id: product.variant_id,
          product_name: product.name,
          current_price: currentPrice,
          suggested_price: Number(recommendation.toFixed(2)),
          rationale:
            product.stock_remaining <= (product.low_stock_threshold ?? 10)
              ? "Demand is likely outpacing stock. A modest increase can protect margin while stock is tight."
              : "Stock is healthy. A slight reduction can improve sell-through without aggressively discounting.",
        }
      })
  }
}

function asNum(value: unknown) {
  if (typeof value === "number") {
    return value
  }
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
