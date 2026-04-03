import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../../auth/_utils/jwt"
import { TaxService } from "../../../../../services/tax.service"

const GenerateInvoiceSchema = z.object({
  sale_id: z.string().trim().min(1),
  location_id: z.string().trim().optional().nullable(),
  customer_pin: z.string().trim().optional().nullable(),
  customer_name: z.string().trim().optional().nullable(),
  customer_address: z.string().trim().optional().nullable(),
  customer_vat_number: z.string().trim().optional().nullable(),
  invoice_type: z.enum(["tax_invoice", "simplified_invoice"]).optional().default("simplified_invoice"),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = GenerateInvoiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid invoice request", errors: parsed.error.flatten() })
    return
  }

  const tax = new TaxService(req.scope)
  const shop = await tax.getShop(auth.shop_id)
  if (!shop) {
    res.status(404).json({ success: false, message: "Shop not found" })
    return
  }

  const sale = await tax.findSaleSnapshot(auth.shop_id, parsed.data.sale_id)
  if (!sale) {
    res.status(404).json({ success: false, message: "Sale not found" })
    return
  }

  const totalAmount = Number(sale.amount_paid ?? sale.price_charged ?? 0)
  if (totalAmount > 10000 && !parsed.data.customer_pin) {
    res.status(400).json({ success: false, message: "Customer PIN required for invoices over KES 10,000" })
    return
  }

  const invoice = await tax.generateInvoiceForSale({
    shopId: auth.shop_id,
    saleId: parsed.data.sale_id,
    locationId: parsed.data.location_id ?? null,
    customerPin: parsed.data.customer_pin ?? null,
    customerName: parsed.data.customer_name ?? null,
    customerAddress: parsed.data.customer_address ?? null,
    customerVatNumber: parsed.data.customer_vat_number ?? null,
    invoiceType: parsed.data.invoice_type,
    vatRate: parsed.data.vat_rate ?? null,
    createdBy: auth.user_id ?? auth.shop_id,
  })

  res.status(201).json({
    success: true,
    invoice: tax.shapeInvoice(invoice as Record<string, unknown>),
  })
}
