import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import {
  getSupplierShop,
  listSupplierCatalog,
  normalizeDeliveryOptions,
  shapeSupplierNetworkShop,
} from "../../_utils/network"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const supplierShop = await getSupplierShop(req.scope, req.params.id)
  if (!supplierShop) {
    res.status(404).json({ success: false, message: "Supplier not found" })
    return
  }

  const catalog = await listSupplierCatalog(req, req.params.id)
  const deliveryOptions = normalizeDeliveryOptions(supplierShop.delivery_options)

  res.status(200).json({
    success: true,
    catalog,
    count: catalog.length,
    supplier_info: {
      ...shapeSupplierNetworkShop(supplierShop),
      delivery_options: deliveryOptions,
    },
  })
}
