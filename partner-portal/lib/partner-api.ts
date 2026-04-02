export const partnerApiBase =
  process.env.NEXT_PUBLIC_PARTNER_API_URL || "http://localhost:9000"

export async function partnerRequest<T>(
  path: string,
  init?: RequestInit & { apiKey?: string }
): Promise<T> {
  const apiKey = init?.apiKey ?? (typeof window !== "undefined"
    ? localStorage.getItem("partner_api_key") ?? undefined
    : undefined)

  const response = await fetch(`${partnerApiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Partner-API-Key": apiKey } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>
  }

  return response.blob() as Promise<T>
}
