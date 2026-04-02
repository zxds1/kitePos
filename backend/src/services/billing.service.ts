type BillingCustomerInput = {
  partnerId: string
  email: string
  name: string
}

type ChargeForExportInput = {
  stripeCustomerId?: string | null
  rowsExported: number
  pricePerRow?: number
  description: string
}

export class BillingService {
  async createCustomer(input: BillingCustomerInput) {
    return {
      provider: "stub",
      customer_id: `stub_customer_${input.partnerId}`,
      email: input.email,
      name: input.name,
    }
  }

  async chargeForExport(input: ChargeForExportInput) {
    const pricePerRow = input.pricePerRow ?? 0.01
    const amount = Math.round(input.rowsExported * pricePerRow * 100) / 100

    return {
      provider: "stub",
      status: "pending_external_billing_setup",
      stripe_customer_id: input.stripeCustomerId ?? null,
      amount,
      currency: "usd",
      description: input.description,
      metadata: {
        rows_exported: input.rowsExported,
        price_per_row: pricePerRow,
      },
    }
  }

  async createSubscription({
    stripeCustomerId,
    priceId,
  }: {
    stripeCustomerId: string
    priceId: string
  }) {
    return {
      provider: "stub",
      status: "pending_external_billing_setup",
      stripe_customer_id: stripeCustomerId,
      price_id: priceId,
    }
  }
}
