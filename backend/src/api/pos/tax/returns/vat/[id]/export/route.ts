import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../../../auth/_utils/jwt"
import { VAT_RETURN_MODULE } from "../../../../../../../modules/vat-return"
import type VatReturnModuleService from "../../../../../../../modules/vat-return/service"
import { TaxService } from "../../../../../../../services/tax.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: VatReturnModuleService = req.scope.resolve(VAT_RETURN_MODULE)
  const [entries] = await service.listAndCountVatReturns(
    { id: req.params.id, shop_id: auth.shop_id },
    { take: 1 }
  )
  const record = entries[0] as Record<string, unknown> | undefined
  if (!record) {
    res.status(404).json({ success: false, message: "VAT return not found" })
    return
  }

  const tax = new TaxService(req.scope)
  const csv = tax.buildVatReturnCsv(record)
  res.status(200).json({
    success: true,
    filename: `VAT3_${record.return_period ?? "export"}.csv`,
    content_type: "text/csv",
    csv,
  })
}
