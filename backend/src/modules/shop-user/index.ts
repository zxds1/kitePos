import { Module } from "@medusajs/framework/utils"
import ShopUserModuleService from "./service"

export const SHOP_USER_MODULE = "shop_user"

export default Module(SHOP_USER_MODULE, {
  service: ShopUserModuleService,
})
