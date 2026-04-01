import { Module } from "@medusajs/framework/utils"
import SaleSnapshotModuleService from "./service"

export const SALE_SNAPSHOT_MODULE = "sale_snapshot"

export default Module(SALE_SNAPSHOT_MODULE, {
  service: SaleSnapshotModuleService,
})
