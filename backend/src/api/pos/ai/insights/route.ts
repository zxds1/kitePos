import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"
import { getAuthorizedShop } from "../../settings/_utils"
import { AIService } from "../../../../services/ai.service"
import { InventoryAIService } from "../../../../services/inventory-ai.service"
import { PricingAIService } from "../../../../services/pricing-ai.service"
import { MarketingAIService } from "../../../../services/marketing-ai.service"
import { SALE_SNAPSHOT_MODULE } from "../../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../../modules/sale-snapshot/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const shop = await getAuthorizedShop(shopService, auth.shop_id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const aiService = new AIService(req.scope)
  const inventoryService = new InventoryAIService()
  const pricingService = new PricingAIService()
  const marketingService = new MarketingAIService(aiService)
  const salesService: SaleSnapshotModuleService = req.scope.resolve(SALE_SNAPSHOT_MODULE)

  const [inventory, pricing, marketing, sales] = await Promise.all([
    inventoryService.getInsights(req, auth.shop_id),
    pricingService.getInsights(req, auth.shop_id),
    marketingService.getInsight(req, auth.shop_id, String(shop.shop_name ?? "Your shop")),
    salesService.listSaleSnapshots(
      { shop_id: auth.shop_id },
      { take: 30, order: { timestamp: "DESC" } }
    ),
  ])

  const recentSales = (sales as Array<Record<string, unknown>>).slice(0, 30)
  const onlineOrders = recentSales.filter(
    (entry) => String(entry.sales_channel ?? "pos") !== "pos"
  ).length

  res.status(200).json({
    success: true,
    insights: {
      inventory,
      pricing,
      marketing,
      analytics: {
        total_recent_sales: recentSales.length,
        online_sales_count: onlineOrders,
        summary:
          onlineOrders > 0
            ? "Online demand is active. Keep promoted items in stock and prioritize fast-moving SKUs."
            : "Online traffic is still early. Use promotions and shareable store links to drive the first wave of storefront orders.",
      },
    },
  })
}
