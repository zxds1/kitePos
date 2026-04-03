import { Module } from "@medusajs/framework/utils"
import LoyaltyLedgerModuleService from "./service"

export const LOYALTY_LEDGER_MODULE = "loyalty_ledger"

export default Module(LOYALTY_LEDGER_MODULE, {
  service: LoyaltyLedgerModuleService,
})
