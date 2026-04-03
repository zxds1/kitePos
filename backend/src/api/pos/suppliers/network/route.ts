import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { SHOP_MODULE } from "../../../../modules/shop"
import type ShopModuleService from "../../../../modules/shop/service"
import { shapeSupplierNetworkShop } from "../_utils/network"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)
  const [shops] = await shopService.listAndCountShops(
    { is_supplier: true, is_active: true },
    { take: 200, order: { created_at: "ASC" } }
  )

  const network = (shops as Array<Record<string, unknown>>)
    .filter((shop) => String(shop.id) != auth.shop_id)
    .map(shapeSupplierNetworkShop)

  res.status(200).json({
    success: true,
    suppliers: network,
  })
}
