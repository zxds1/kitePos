import { BillingService, pricePerRowForBillingTier } from "../../../services/billing.service"
import type { PartnerRecord } from "../../../modules/partner/service"

export async function billPartnerExport(input: {
  partner: PartnerRecord
  rowsExported: number
  dataType: string
  format: "json" | "csv" | "api"
}) {
  const billingService = new BillingService()
  return billingService.chargeForExport({
    stripeCustomerId: input.partner.stripe_customer_id ?? null,
    rowsExported: input.rowsExported,
    pricePerRow: pricePerRowForBillingTier(input.partner.billing_tier),
    description: `Partner ${input.dataType} export (${input.format})`,
  })
}
