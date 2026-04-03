import { Module } from "@medusajs/framework/utils"
import TaxReportRunModuleService from "./service"

export const TAX_REPORT_RUN_MODULE = "tax_report_run"

export default Module(TAX_REPORT_RUN_MODULE, {
  service: TaxReportRunModuleService,
})
