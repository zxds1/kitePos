import { Module } from "@medusajs/framework/utils"
import OnlineStoreModuleService from "./service"

export const ONLINE_STORE_MODULE = "online_store"

export default Module(ONLINE_STORE_MODULE, {
  service: OnlineStoreModuleService,
})
