import {
  BillingConfigurationError,
  BillingService,
  pricePerRowForBillingTier,
} from "../billing.service"

global.fetch = jest.fn() as any

describe("BillingService", () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockReset()
  })

  it("creates a Stripe customer with partner metadata", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: "cus_123",
      }),
    })

    const service = new BillingService({
      secretKey: "sk_test_123",
      apiBaseUrl: "https://api.stripe.com/v1",
    })

    const result = await service.createCustomer({
      partnerId: "partner_1",
      email: "billing@example.com",
      name: "Trace Partner",
    })

    expect(result).toEqual({
      provider: "stripe",
      customer_id: "cus_123",
      email: "billing@example.com",
      name: "Trace Partner",
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/customers",
      expect.objectContaining({
        method: "POST",
      })
    )

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const body = init.body as URLSearchParams
    expect(body.get("email")).toBe("billing@example.com")
    expect(body.get("name")).toBe("Trace Partner")
    expect(body.get("metadata[partner_id]")).toBe("partner_1")
  })

  it("creates a payment intent for export charges", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: "pi_123",
        status: "requires_confirmation",
        client_secret: "secret_123",
      }),
    })

    const service = new BillingService({
      secretKey: "sk_test_123",
      apiBaseUrl: "https://api.stripe.com/v1",
      currency: "kes",
    })

    const result = await service.chargeForExport({
      stripeCustomerId: "cus_123",
      rowsExported: 250,
      pricePerRow: 0.02,
      description: "Partner export billing",
    })

    expect(result.provider).toBe("stripe")
    expect(result.status).toBe("requires_confirmation")
    expect(result.payment_intent_id).toBe("pi_123")
    expect(result.client_secret).toBe("secret_123")
    expect(result.amount).toBe(5)
    expect(result.currency).toBe("kes")

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const body = init.body as URLSearchParams
    expect(body.get("amount")).toBe("500")
    expect(body.get("currency")).toBe("kes")
    expect(body.get("customer")).toBe("cus_123")
    expect(body.get("metadata[rows_exported]")).toBe("250")
    expect(body.get("metadata[price_per_row]")).toBe("0.02")
  })

  it("creates a checkout session for subscriptions", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: "cs_123",
        status: "open",
        url: "https://checkout.stripe.com/c/pay/cs_123",
      }),
    })

    const service = new BillingService({
      secretKey: "sk_test_123",
      apiBaseUrl: "https://api.stripe.com/v1",
      subscriptionSuccessUrl: "https://example.com/success",
      subscriptionCancelUrl: "https://example.com/cancel",
    })

    const result = await service.createSubscription({
      stripeCustomerId: "cus_123",
      priceId: "price_123",
    })

    expect(result).toEqual({
      provider: "stripe",
      status: "open",
      stripe_customer_id: "cus_123",
      price_id: "price_123",
      checkout_session_id: "cs_123",
      checkout_url: "https://checkout.stripe.com/c/pay/cs_123",
    })

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const body = init.body as URLSearchParams
    expect(body.get("mode")).toBe("subscription")
    expect(body.get("customer")).toBe("cus_123")
    expect(body.get("line_items[0][price]")).toBe("price_123")
    expect(body.get("success_url")).toBe("https://example.com/success")
    expect(body.get("cancel_url")).toBe("https://example.com/cancel")
  })

  it("fails fast when Stripe is not configured", async () => {
    const service = new BillingService({
      secretKey: "",
    })

    await expect(
      service.createCustomer({
        partnerId: "partner_1",
        email: "billing@example.com",
        name: "Trace Partner",
      })
    ).rejects.toBeInstanceOf(BillingConfigurationError)
  })

  it("maps billing tiers to deterministic export prices", () => {
    expect(pricePerRowForBillingTier("enterprise")).toBe(0.01)
    expect(pricePerRowForBillingTier("premium")).toBe(0.02)
    expect(pricePerRowForBillingTier("basic")).toBe(0.03)
    expect(pricePerRowForBillingTier("free")).toBe(0.05)
    expect(pricePerRowForBillingTier("unknown")).toBe(0.05)
  })
})
