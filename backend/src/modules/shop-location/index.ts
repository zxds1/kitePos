import { Module } from "@medusajs/framework/utils"
import ShopLocationModuleService from "./service"

export const SHOP_LOCATION_MODULE = "shop_location"

export default Module(SHOP_LOCATION_MODULE, {
  service: ShopLocationModuleService,
})
