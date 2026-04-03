import { Module } from "@medusajs/framework/utils"
import ShiftSessionModuleService from "./service"

export const SHIFT_SESSION_MODULE = "shift_session"

export default Module(SHIFT_SESSION_MODULE, {
  service: ShiftSessionModuleService,
})
