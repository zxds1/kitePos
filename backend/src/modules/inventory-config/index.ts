import { Module } from "@medusajs/framework/utils"
import InventoryConfigModuleService from "./service"

export const INVENTORY_CONFIG_MODULE = "inventory_config"

export default Module(INVENTORY_CONFIG_MODULE, {
  service: InventoryConfigModuleService,
})
