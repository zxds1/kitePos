import { Module } from "@medusajs/framework/utils"
import ShopTerminalModuleService from "./service"

export const SHOP_TERMINAL_MODULE = "shop_terminal"

export default Module(SHOP_TERMINAL_MODULE, {
  service: ShopTerminalModuleService,
})
