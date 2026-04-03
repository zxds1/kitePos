import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { TAX_INVOICE_MODULE } from "../../../../modules/tax-invoice"
import type TaxInvoiceModuleService from "../../../../modules/tax-invoice/service"
import { TaxService } from "../../../../services/tax.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: TaxInvoiceModuleService = req.scope.resolve(TAX_INVOICE_MODULE)
  const [invoices] = await service.listAndCountTaxInvoices(
    { shop_id: auth.shop_id },
    { take: 50, order: { created_at: "DESC" } }
  )

  const tax = new TaxService(req.scope)
  res.status(200).json({
    success: true,
    invoices: (invoices as Array<Record<string, unknown>>).map((entry) => tax.shapeInvoice(entry)),
  })
}
