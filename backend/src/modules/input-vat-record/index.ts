import { Module } from "@medusajs/framework/utils"
import InputVatRecordModuleService from "./service"

export const INPUT_VAT_RECORD_MODULE = "input_vat_record"

export default Module(INPUT_VAT_RECORD_MODULE, {
  service: InputVatRecordModuleService,
})
