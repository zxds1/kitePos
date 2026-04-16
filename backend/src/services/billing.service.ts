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

type BillingServiceConfig = {
  secretKey?: string
  apiBaseUrl?: string
  currency?: string
  apiVersion?: string
  subscriptionSuccessUrl?: string
  subscriptionCancelUrl?: string
}

type StripeApiError = {
  error?: {
    message?: string
  }
}

const DEFAULT_STRIPE_API_BASE_URL = "https://api.stripe.com/v1"
const DEFAULT_CURRENCY = "usd"

export class BillingConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BillingConfigurationError"
  }
}

export function pricePerRowForBillingTier(tier: string) {
  switch (tier.toLowerCase()) {
    case "enterprise":
      return 0.01
    case "premium":
      return 0.02
    case "basic":
      return 0.03
    case "free":
    default:
      return 0.05
  }
}

export class BillingService {
  private readonly secretKey: string | null
  private readonly apiBaseUrl: string
  private readonly currency: string
  private readonly apiVersion: string | null
  private readonly subscriptionSuccessUrl: string | null
  private readonly subscriptionCancelUrl: string | null

  constructor(config: BillingServiceConfig = {}) {
    this.secretKey = config.secretKey ?? process.env.STRIPE_SECRET_KEY ?? null
    this.apiBaseUrl = config.apiBaseUrl ?? process.env.STRIPE_API_BASE_URL ?? DEFAULT_STRIPE_API_BASE_URL
    this.currency = (config.currency ?? process.env.STRIPE_CURRENCY ?? DEFAULT_CURRENCY).toLowerCase()
    this.apiVersion = config.apiVersion ?? process.env.STRIPE_API_VERSION ?? null
    this.subscriptionSuccessUrl =
      config.subscriptionSuccessUrl ?? process.env.STRIPE_SUBSCRIPTION_SUCCESS_URL ?? null
    this.subscriptionCancelUrl =
      config.subscriptionCancelUrl ?? process.env.STRIPE_SUBSCRIPTION_CANCEL_URL ?? null
  }

  async createCustomer(input: BillingCustomerInput) {
    const customer = await this.stripeRequest<{ id: string }>(
      "/customers",
      {
        email: input.email,
        name: input.name,
        "metadata[partner_id]": input.partnerId,
      },
      "create-customer"
    )

    return {
      provider: "stripe" as const,
      customer_id: customer.id,
      email: input.email,
      name: input.name,
    }
  }

  async chargeForExport(input: ChargeForExportInput) {
    const pricePerRow = input.pricePerRow ?? 0.01
    const amount = Math.max(0, Math.round(input.rowsExported * pricePerRow * 100) / 100)

    if (amount <= 0) {
      return {
        provider: "stripe" as const,
        status: "not_required" as const,
        stripe_customer_id: input.stripeCustomerId ?? null,
        amount,
        currency: this.currency,
        description: input.description,
        metadata: {
          rows_exported: input.rowsExported,
          price_per_row: pricePerRow,
        },
      }
    }

    const paymentIntent = await this.stripeRequest<{
      id: string
      status: string
      client_secret?: string | null
    }>("/payment_intents", {
      amount: Math.round(amount * 100),
      currency: this.currency,
      ...(input.stripeCustomerId ? { customer: input.stripeCustomerId } : {}),
      description: input.description,
      "metadata[rows_exported]": String(input.rowsExported),
      "metadata[price_per_row]": String(pricePerRow),
      "metadata[charge_type]": "data_export",
    })

    return {
      provider: "stripe" as const,
      status: paymentIntent.status,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret ?? null,
      stripe_customer_id: input.stripeCustomerId ?? null,
      amount,
      currency: this.currency,
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
    this.requireCheckoutConfiguration()

    const session = await this.stripeRequest<{
      id: string
      status: string
      url?: string | null
    }>("/checkout/sessions", {
      mode: "subscription",
      customer: stripeCustomerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      success_url: this.subscriptionSuccessUrl!,
      cancel_url: this.subscriptionCancelUrl!,
      "metadata[stripe_customer_id]": stripeCustomerId,
      "metadata[price_id]": priceId,
    })

    return {
      provider: "stripe" as const,
      status: session.status,
      stripe_customer_id: stripeCustomerId,
      price_id: priceId,
      checkout_session_id: session.id,
      checkout_url: session.url ?? null,
    }
  }

  private requireSecretKey() {
    if (!this.secretKey) {
      throw new BillingConfigurationError(
        "Stripe billing is not configured. Set STRIPE_SECRET_KEY to enable partner billing."
      )
    }
    return this.secretKey
  }

  private requireCheckoutConfiguration() {
    this.requireSecretKey()
    if (!this.subscriptionSuccessUrl || !this.subscriptionCancelUrl) {
      throw new BillingConfigurationError(
        "Stripe checkout URLs are not configured. Set STRIPE_SUBSCRIPTION_SUCCESS_URL and STRIPE_SUBSCRIPTION_CANCEL_URL."
      )
    }
  }

  private async stripeRequest<T>(
    path: string,
    data: Record<string, string | number | boolean | null | undefined>,
    idempotencyKey?: string
  ): Promise<T> {
    const secretKey = this.requireSecretKey()
    const url = `${this.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`
    const body = new URLSearchParams()

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) {
        continue
      }
      body.set(key, String(value))
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(this.apiVersion ? { "Stripe-Version": this.apiVersion } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body,
    })

    const payload = (await response.json()) as T & StripeApiError
    if (!response.ok) {
      throw new BillingConfigurationError(
        payload.error?.message ??
          `Stripe request failed with status ${response.status} for ${path}`
      )
    }

    return payload
  }
}
