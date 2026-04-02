import { Module } from "@medusajs/framework/utils"
import AnalyticsSnapshotModuleService from "./service"

export const ANALYTICS_SNAPSHOT_MODULE = "analytics_snapshot"

export default Module(ANALYTICS_SNAPSHOT_MODULE, {
  service: AnalyticsSnapshotModuleService,
})
