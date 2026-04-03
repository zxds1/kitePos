import { Module } from "@medusajs/framework/utils"
import RefundTransactionModuleService from "./service"

export const REFUND_TRANSACTION_MODULE = "refund_transaction"

export default Module(REFUND_TRANSACTION_MODULE, {
  service: RefundTransactionModuleService,
})
