import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADJUSTMENT_MODULE } from "../../../modules/adjustment"
import type AdjustmentModuleService from "../../../modules/adjustment/service"
import { ANALYTICS_SNAPSHOT_MODULE } from "../../../modules/analytics-snapshot"
import type AnalyticsSnapshotModuleService from "../../../modules/analytics-snapshot/service"
import { RESTOCK_MODULE } from "../../../modules/restock"
import type RestockModuleService from "../../../modules/restock/service"
import { SALE_SNAPSHOT_MODULE } from "../../../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../../../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../../../modules/shop"
import type ShopModuleService from "../../../modules/shop/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../auth/_utils/jwt"
import { getAuthorizedShop, shapePrivacyConsent, shapeShopProfile } from "../settings/_utils"
import { listNormalizedProducts } from "../../admin/products/_utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth || !auth.shop_id) {
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
  const saleSnapshotService: SaleSnapshotModuleService = req.scope.resolve(
    SALE_SNAPSHOT_MODULE
  )
  const adjustmentService: AdjustmentModuleService = req.scope.resolve(
    ADJUSTMENT_MODULE
  )
  const analyticsSnapshotService: AnalyticsSnapshotModuleService =
    req.scope.resolve(ANALYTICS_SNAPSHOT_MODULE)

  const shop = await getAuthorizedShop(shopService, auth.shop_id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const [restocks, saleSnapshots, adjustments, analyticsSnapshots, products] =
    await Promise.all([
      restockService.listRestocks({ shop_id: auth.shop_id }),
      saleSnapshotService.listSaleSnapshots({ shop_id: auth.shop_id }),
      adjustmentService.listAdjustments({ shop_id: auth.shop_id }),
      analyticsSnapshotService.listAnalyticsSnapshots({ shop_id: auth.shop_id }),
      listNormalizedProducts(req, { shopId: auth.shop_id }),
    ])

  res.status(200).json({
    success: true,
    data: {
      exported_at: new Date().toISOString(),
      profile: shapeShopProfile(shop, auth),
      payment_settings: {
        mpesa_phone: shop.mpesa_phone,
        mpesa_till: shop.mpesa_till,
        mpesa_paybill: shop.mpesa_paybill,
        accept_mpesa: shop.accept_mpesa,
        mpesa_display_name: shop.mpesa_display_name,
      },
      privacy_consent: shapePrivacyConsent(shop),
      products,
      restocks,
      sale_snapshots: saleSnapshots,
      adjustments,
      analytics_snapshots: analyticsSnapshots,
    },
  })
}
