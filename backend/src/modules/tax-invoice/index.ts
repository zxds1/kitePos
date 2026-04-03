import { Module } from "@medusajs/framework/utils"
import TaxInvoiceModuleService from "./service"

export const TAX_INVOICE_MODULE = "tax_invoice"

export default Module(TAX_INVOICE_MODULE, {
  service: TaxInvoiceModuleService,
})
