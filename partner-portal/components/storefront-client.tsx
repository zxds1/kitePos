"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import type { StorefrontData, StorefrontProduct } from "@/lib/storefront"
import { askStoreAssistant, asPrice } from "@/lib/storefront"

type Props = {
  storefront: StorefrontData
  accentColor: string
}

type CartLine = {
  variantId: string
  name: string
  price: number
  quantity: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value)
}

function buildWhatsAppLink(
  phoneNumber: string,
  shopName: string,
  lines: CartLine[]
) {
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const body = [
    `Hello ${shopName}, I would like to order:`,
    ...lines.map(
      (line) =>
        `- ${line.name} x${line.quantity} = ${formatCurrency(
          line.price * line.quantity
        )}`
    ),
    "",
    `Total: ${formatCurrency(total)}`,
  ].join("\n")

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(body)}`
}

export function StorefrontClient({ storefront, accentColor }: Props) {
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantRole, setAssistantRole] = useState<"buyer" | "seller">("buyer")
  const [assistantQuery, setAssistantQuery] = useState("")
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantMessages, setAssistantMessages] = useState<
    Array<{ role: "assistant" | "user"; text: string }>
  >([
    {
      role: "assistant",
      text:
        "Ask about products, delivery, orders, receipts, stock, supplier documents, or store policy.",
    },
  ])

  const shop = storefront.shop
  const products = storefront.products
  const shopName = String(shop.shop_name ?? "Trace Shop")
  const slug = String(storefront.store.slug ?? storefront.store.subdomain ?? "")
  const merchantPhone = String(
    shop.mpesa_phone ?? shop.owner_phone ?? ""
  ).replace(/\D/g, "")

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return products
    }

    return products.filter((product) => {
      return [product.name, product.category ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    })
  }, [products, query])

  const lines = Object.values(cart).filter((line) => line.quantity > 0)
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const whatsappHref =
    merchantPhone && lines.length
      ? buildWhatsAppLink(merchantPhone, shopName, lines)
      : null

  function updateQuantity(product: StorefrontProduct, nextQuantity: number) {
    const price = asPrice(product)
    setCart((current) => ({
      ...current,
      [product.variant_id]: {
        variantId: product.variant_id,
        name: product.name,
        price,
        quantity: Math.max(0, nextQuantity),
      },
    }))
  }

  async function copySummary() {
    if (!lines.length) {
      return
    }
    const summary = lines
      .map(
        (line) =>
          `${line.name} x${line.quantity} = ${formatCurrency(
            line.price * line.quantity
          )}`
      )
      .concat(`Total: ${formatCurrency(total)}`)
      .join("\n")

    await navigator.clipboard.writeText(summary)
  }

  async function sendAssistantMessage() {
    const trimmed = assistantQuery.trim()
    if (!trimmed || !slug) {
      return
    }

    setAssistantMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
    ])
    setAssistantQuery("")
    setAssistantLoading(true)

    try {
      const result = await askStoreAssistant(slug, {
        query: trimmed,
        actor: assistantRole,
      })
      setAssistantMessages((current) => [
        ...current,
        { role: "assistant", text: result.response || "No answer available." },
      ])
    } catch (error) {
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Assistant unavailable.",
        },
      ])
    } finally {
      setAssistantLoading(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_360px]">
      <div className="space-y-6">
        <div className="rounded-[28px] border border-trace-line bg-white p-5 shadow-panel">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, categories, or featured items"
            className="w-full rounded-2xl border border-trace-line bg-trace-sand px-4 py-4 text-sm outline-none ring-0"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const line = cart[product.variant_id]
            const quantity = line?.quantity ?? 0
            const price = asPrice(product)
            const inStock = product.stock_remaining > 0

            return (
              <article
                key={product.variant_id}
                className="overflow-hidden rounded-[28px] border border-trace-line bg-white shadow-panel"
              >
                <div className="relative h-56 bg-trace-mist">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full items-center justify-center text-5xl font-black"
                      style={{ color: accentColor }}
                    >
                      {product.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                      {product.category ?? "Catalog"}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-trace-deep">
                      {product.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatCurrency(price)}{" "}
                      {inStock
                        ? `• ${product.stock_remaining} in stock`
                        : "• Out of stock"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-full border border-trace-line px-3 py-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(product, quantity - 1)}
                      className="h-9 w-9 rounded-full text-xl font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(product, quantity + 1)}
                      disabled={!inStock}
                      className="h-9 w-9 rounded-full text-xl font-bold disabled:opacity-40"
                      style={{ color: accentColor }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[30px] border border-trace-line bg-white p-6 shadow-panel">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            Cart
          </p>
          <h2 className="mt-3 text-2xl font-black text-trace-deep">
            Review your order
          </h2>
          <div className="mt-6 space-y-3">
            {lines.length ? (
              lines.map((line) => (
                <div
                  key={line.variantId}
                  className="flex items-start justify-between gap-4 rounded-2xl bg-trace-sand px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-trace-deep">{line.name}</p>
                    <p className="text-sm text-slate-600">
                      {line.quantity} x {formatCurrency(line.price)}
                    </p>
                  </div>
                  <p className="font-bold text-trace-deep">
                    {formatCurrency(line.quantity * line.price)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-trace-sand px-4 py-4 text-sm text-slate-600">
                No items selected yet.
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between text-lg font-black text-trace-deep">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex w-full items-center justify-center rounded-2xl px-4 py-4 text-sm font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              Checkout on WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-2xl bg-slate-300 px-4 py-4 text-sm font-bold text-slate-600"
            >
              Merchant contact unavailable
            </button>
          )}

          <button
            type="button"
            onClick={copySummary}
            className="mt-3 w-full rounded-2xl border border-trace-line px-4 py-4 text-sm font-bold text-trace-deep"
          >
            Copy order summary
          </button>

          <div className="mt-6 rounded-[24px] bg-trace-deep p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
              Payment
            </p>
            <p className="mt-3 text-sm leading-7 text-white/85">
              Complete payment using the merchant instructions shown on the page,
              then share your confirmation in the checkout thread.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAssistantOpen((current) => !current)}
            className="mt-4 w-full rounded-2xl border border-trace-line px-4 py-4 text-sm font-bold text-trace-deep"
          >
            {assistantOpen ? "Hide store assistant" : "Open store assistant"}
          </button>
        </div>

        {assistantOpen ? (
          <div className="mt-4 rounded-[30px] border border-trace-line bg-white p-6 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                  Assistant
                </p>
                <h3 className="mt-2 text-xl font-black text-trace-deep">
                  Buyer and seller support
                </h3>
              </div>
              <div className="flex rounded-full bg-trace-sand p-1 text-sm font-bold">
                {(["buyer", "seller"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setAssistantRole(role)}
                    className={`rounded-full px-4 py-2 ${
                      assistantRole === role ? "bg-white text-trace-deep shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {role === "buyer" ? "Buyer" : "Seller"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {assistantMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === "assistant"
                      ? "bg-trace-sand text-slate-700"
                      : "ml-8 bg-trace-deep text-white"
                  }`}
                >
                  {message.text}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={assistantQuery}
                onChange={(event) => setAssistantQuery(event.target.value)}
                placeholder={
                  assistantRole === "buyer"
                    ? "Ask about products, payment, delivery, or returns"
                    : "Ask about stock, receipts, pricing, or supplier docs"
                }
                className="w-full rounded-2xl border border-trace-line bg-trace-sand px-4 py-4 text-sm outline-none"
              />
              <button
                type="button"
                onClick={sendAssistantMessage}
                disabled={assistantLoading}
                className="rounded-2xl px-5 py-4 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {assistantLoading ? "..." : "Send"}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
