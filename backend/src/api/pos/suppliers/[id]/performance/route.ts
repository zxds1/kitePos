import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { SUPPLIER_MODULE } from "../../../../../modules/supplier"
import type SupplierModuleService from "../../../../../modules/supplier/service"
import { RESTOCK_MODULE } from "../../../../../modules/restock"
import type RestockModuleService from "../../../../../modules/restock/service"

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const supplierService: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE)
  const restockService: RestockModuleService = req.scope.resolve(RESTOCK_MODULE)
  const [suppliers] = await supplierService.listAndCountSuppliers(
    { id: req.params.id, shop_id: auth.shop_id },
    { take: 1 }
  )
  const supplier = suppliers[0] as Record<string, unknown> | undefined
  if (!supplier) {
    res.status(404).json({ success: false, message: "Supplier not found" })
    return
  }

  const [restocks] = await restockService.listAndCountRestocks(
    { shop_id: auth.shop_id, supplier_name: String(supplier.name) },
    { take: 500, order: { timestamp: "DESC" } }
  )
  const records = (restocks as Array<Record<string, unknown>>) ?? []
  const totalSpend = records.reduce((sum, item) => sum + asNumber(item.total_cost), 0)

  res.status(200).json({
    success: true,
    performance: {
      supplier_id: req.params.id,
      purchase_orders: records.length,
      total_spend: Number(totalSpend.toFixed(2)),
      average_order_value:
        records.length > 0 ? Number((totalSpend / records.length).toFixed(2)) : 0,
      last_delivery_at: records[0]?.timestamp ?? null,
    },
  })
}
