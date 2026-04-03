import { Module } from "@medusajs/framework/utils"
import VatReturnModuleService from "./service"

export const VAT_RETURN_MODULE = "vat_return"

export default Module(VAT_RETURN_MODULE, {
  service: VatReturnModuleService,
})
