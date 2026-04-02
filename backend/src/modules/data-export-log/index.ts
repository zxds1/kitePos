import { Module } from "@medusajs/framework/utils"
import DataExportLogModuleService from "./service"

export const DATA_EXPORT_LOG_MODULE = "data_export_log"

export default Module(DATA_EXPORT_LOG_MODULE, {
  service: DataExportLogModuleService,
})
