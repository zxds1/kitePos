export type StorefrontProduct = {
  id: string
  variant_id: string
  name: string
  category: string | null
  stock_remaining: number
  image_url: string | null
  selling_units: Array<Record<string, unknown>>
}

export type StorefrontData = {
  store: Record<string, unknown>
  shop: Record<string, unknown>
  products: StorefrontProduct[]
}

export type StorefrontAssistantResponse = {
  response: string
  rag_source: string
  intent: string
}

export async function getStorefront(slug: string): Promise<StorefrontData | null> {
  const apiBaseUrl =
    process.env.STOREFRONT_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:9000"

  const response = await fetch(
    `${apiBaseUrl.replace(/\/+$/, "")}/shops/${encodeURIComponent(slug)}?format=json`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to load storefront: ${response.status}`)
  }

  const payload = (await response.json()) as {
    storefront?: StorefrontData
  }

  return payload.storefront ?? null
}

export function getAccentColor(store: Record<string, unknown>) {
  const themeConfig = asMap(store.theme_config)
  const accent = themeConfig.accent_color
  return typeof accent === "string" && accent.trim() ? accent : "#1E5D89"
}

export function getStoreText(
  source: Record<string, unknown>,
  key: string,
  fallback: string
) {
  const content = asMap(source.storefront_content)
  const value = content[key]
  return typeof value === "string" && value.trim() ? value : fallback
}

export function asMap(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

export function asPrice(product: StorefrontProduct) {
  const firstUnit = product.selling_units[0] ?? {}
  const value = firstUnit["price"]
  const amount = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export async function askStoreAssistant(
  slug: string,
  input: { query: string; actor: "buyer" | "seller" }
): Promise<StorefrontAssistantResponse> {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.STOREFRONT_API_BASE_URL ??
    "http://127.0.0.1:9000"

  const response = await fetch(
    `${apiBaseUrl.replace(/\/+$/, "")}/shops/${encodeURIComponent(slug)}/assistant`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    }
  )

  if (!response.ok) {
    throw new Error(`Assistant unavailable: ${response.status}`)
  }

  const payload = (await response.json()) as Record<string, unknown>
  return {
    response: String(payload.response ?? ""),
    rag_source: String(payload.rag_source ?? ""),
    intent: String(payload.intent ?? ""),
  }
}
