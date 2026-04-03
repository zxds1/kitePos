import { Module } from "@medusajs/framework/utils"
import TaxReportModuleService from "./service"

export const TAX_REPORT_MODULE = "tax_report"

export default Module(TAX_REPORT_MODULE, {
  service: TaxReportModuleService,
})
