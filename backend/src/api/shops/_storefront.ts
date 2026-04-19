import type { MedusaRequest } from "@medusajs/framework/http"
import { ONLINE_STORE_MODULE } from "../../modules/online-store"
import type OnlineStoreModuleService from "../../modules/online-store/service"
import { SHOP_MODULE } from "../../modules/shop"
import type ShopModuleService from "../../modules/shop/service"
import { listNormalizedProducts } from "../admin/products/_utils"

type StoreRecord = Record<string, unknown>
type ShopRecord = Record<string, unknown>

export type StorefrontPayload = {
  store: StoreRecord
  shop: ShopRecord
  products: Awaited<ReturnType<typeof listNormalizedProducts>>
}

export async function resolveStorefront(
  req: MedusaRequest,
  input: {
    slug?: string | null
    host?: string | null
  }
): Promise<StorefrontPayload | null> {
  const onlineStoreService: OnlineStoreModuleService = req.scope.resolve(
    ONLINE_STORE_MODULE
  )
  const shopService: ShopModuleService = req.scope.resolve(SHOP_MODULE)

  const slug = normalizeSlug(input.slug)
  const subdomain = extractSubdomain(input.host)

  const [store] = await onlineStoreService.listOnlineStores(
    {
      ...(slug ? { slug } : {}),
      ...(!slug && subdomain ? { subdomain } : {}),
      is_active: true,
    },
    { take: 1, order: { updated_at: "DESC" } }
  )

  const storeRecord = (store as StoreRecord | undefined) ?? null
  if (!storeRecord?.shop_id) {
    return null
  }

  const [shop] = await shopService.listShops(
    { id: String(storeRecord.shop_id), is_active: true },
    { take: 1 }
  )

  const shopRecord = (shop as ShopRecord | undefined) ?? null
  if (!shopRecord) {
    return null
  }

  const products = await listNormalizedProducts(req, {
    shopId: String(storeRecord.shop_id),
  })

  return {
    store: storeRecord,
    shop: shopRecord,
    products: products.filter((product) => product.is_active),
  }
}

export function renderStorefrontHtml(payload: StorefrontPayload) {
  const shopName = text(payload.shop.shop_name, "Trace Shop")
  const brandName = "Trace"
  const storeContent = getMap(payload.store.storefront_content)
  const themeConfig = getMap(payload.store.theme_config)
  const siteBrief = getMap(storeContent.site_brief)
  const heroTitle = text(storeContent.hero_title, `${shopName} online`)
  const heroSubtitle = text(
    storeContent.hero_subtitle,
    "Browse live stock, build an order, and pay via M-Pesa."
  )
  const accent = text(themeConfig.accent_color, "#195E86")
  const colorDescription = text(themeConfig.color_description, "calm retail colors")
  const visualStyle = text(storeContent.visual_style, "clean retail editorial")
  const referenceStyle = text(
    storeContent.reference_style,
    text(siteBrief.reference_style, "local retail polish")
  )
  const toneStyle = text(
    storeContent.tone_style,
    text(siteBrief.tone_style, "warm and confident")
  )
  const writingStyle = text(
    storeContent.writing_style,
    text(siteBrief.writing_style, "short headlines and simple sentences")
  )
  const layoutNotes = text(
    storeContent.layout_notes,
    "hero, featured catalog, trust details, and contact footer"
  )
  const trustSignals = asStringArray(
    storeContent.trust_signals,
    ["business contact", "secure checkout", "returns guidance"]
  )
  const securityNotes = asStringArray(
    storeContent.security_notes,
    ["HTTPS-only links", "no custom scripts", "plain-language policies"]
  )
  const ctaStyle = text(storeContent.cta_style, "Order on WhatsApp")
  const whatsappNumber = digitsOnly(
    payload.shop.mpesa_phone ?? payload.shop.owner_phone ?? ""
  )
  const mpesaDisplay = text(
    payload.shop.mpesa_display_name,
    shopName
  )
  const paymentLabel = text(
    payload.shop.mpesa_till ?? payload.shop.mpesa_paybill ?? payload.shop.mpesa_phone,
    "M-Pesa available at checkout"
  )
  const returnWindow = getMap(payload.shop.online_return_policy).return_window_days
  const productsMarkup = payload.products
    .map((product) => {
      const price = Number(product.selling_units[0]?.["price"] ?? 0)
      const category = escapeHtml(product.category ?? "General")
      const name = escapeHtml(product.name)
      const safeImageUrl = safeHttpsUrl(product.image_url)
      const image = safeImageUrl
        ? `<img src="${escapeHtml(safeImageUrl)}" alt="${name}" class="product-image" />`
        : `<div class="product-image product-image--empty">${name.slice(0, 1)}</div>`
      const stockLabel =
        product.stock_remaining > 0
          ? `${formatKes(price)} • ${product.stock_remaining} in stock`
          : `${formatKes(price)} • Out of stock`

      return `
        <article class="product-card" data-name="${escapeHtml(product.name)}" data-price="${price}">
          ${image}
          <div class="product-body">
            <p class="product-category">${category}</p>
            <h3>${name}</h3>
            <p class="product-meta">${escapeHtml(stockLabel)}</p>
            <div class="product-actions">
              <button class="qty-btn" data-action="decrease">-</button>
              <span class="qty-value">0</span>
              <button class="qty-btn" data-action="increase">+</button>
            </div>
          </div>
        </article>
      `
    })
    .join("")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(shopName)} | ${brandName}</title>
  <meta name="description" content="${escapeHtml(heroSubtitle)}" />
  <style>
    :root {
      --accent: ${escapeHtml(accent)};
      --accent-dark: #0f2b3a;
      --bg: #f5f7f8;
      --surface: #ffffff;
      --text: #11202a;
      --muted: #637381;
      --line: #dbe3e8;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: var(--bg); color: var(--text); }
    a { color: inherit; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .hero {
      background: linear-gradient(135deg, var(--accent-dark), var(--accent));
      color: white; border-radius: 28px; padding: 32px; display: grid; gap: 28px;
      grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
    }
    .eyebrow { display: inline-flex; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 14px 0 12px; font-size: clamp(32px, 5vw, 56px); line-height: 1.02; }
    .hero p { margin: 0; font-size: 17px; line-height: 1.6; max-width: 56ch; color: rgba(255,255,255,0.86); }
    .hero-badges { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .hero-badges span {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.18);
      color: rgba(255,255,255,0.94);
      font-size: 12px;
      font-weight: 700;
    }
    .hero-card, .section, .cart { background: var(--surface); border: 1px solid var(--line); border-radius: 24px; }
    .hero-card { padding: 20px; color: var(--text); }
    .hero-card h2 { margin: 0 0 14px; font-size: 18px; }
    .hero-card p { color: var(--muted); }
    .section { margin-top: 24px; padding: 24px; }
    .section-title { margin: 0 0 20px; font-size: 24px; }
    .catalog-layout { display: grid; gap: 24px; grid-template-columns: minmax(0, 1.6fr) minmax(300px, .8fr); }
    .toolbar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .search { width: 100%; padding: 14px 16px; border-radius: 16px; border: 1px solid var(--line); font-size: 15px; }
    .products { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .product-card { background: #fff; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; }
    .product-image { display: block; width: 100%; height: 190px; object-fit: cover; background: #eef3f5; }
    .product-image--empty { display: grid; place-items: center; font-size: 48px; font-weight: 800; color: var(--accent); }
    .product-body { padding: 16px; }
    .product-category { margin: 0 0 8px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-size: 11px; }
    .product-body h3 { margin: 0 0 8px; font-size: 18px; }
    .product-meta { margin: 0 0 16px; color: var(--muted); font-size: 14px; }
    .product-actions { display: inline-flex; align-items: center; gap: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; }
    .qty-btn { border: 0; background: transparent; color: var(--accent); font-size: 18px; font-weight: 800; cursor: pointer; }
    .qty-value { min-width: 16px; text-align: center; font-weight: 700; }
    .cart { padding: 20px; position: sticky; top: 24px; align-self: start; }
    .cart h3 { margin-top: 0; }
    .cart-list { display: grid; gap: 12px; margin: 16px 0; }
    .cart-row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
    .cart-empty { color: var(--muted); }
    .total { display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; margin-top: 16px; }
    .cta, .secondary {
      width: 100%; display: inline-flex; justify-content: center; align-items: center; padding: 14px 16px;
      border-radius: 16px; text-decoration: none; font-weight: 700; margin-top: 14px;
    }
    .cta { background: var(--accent); color: white; }
    .secondary { border: 1px solid var(--line); background: white; }
    .meta-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .meta-card { padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: white; }
    .meta-card h4 { margin: 0 0 8px; }
    .foot { padding: 26px 0 10px; color: var(--muted); text-align: center; }
    @media (max-width: 920px) {
      .hero, .catalog-layout { grid-template-columns: 1fr; }
      .cart { position: static; }
      .shell { padding: 16px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div>
        <span class="eyebrow">Powered by ${brandName}</span>
        <h1>${escapeHtml(heroTitle)}</h1>
        <p>${escapeHtml(heroSubtitle)}</p>
        <div class="hero-badges">
          <span>${escapeHtml(colorDescription)}</span>
          <span>${escapeHtml(visualStyle)}</span>
          <span>${escapeHtml(ctaStyle)}</span>
        </div>
      </div>
      <aside class="hero-card">
        <h2>Order and pay</h2>
        <p>Build your cart, then send the order directly to ${escapeHtml(shopName)} via WhatsApp.</p>
        <p><strong>M-Pesa pay point:</strong> ${escapeHtml(paymentLabel)}</p>
        <p><strong>Payee name:</strong> ${escapeHtml(mpesaDisplay)}</p>
        <p><strong>Security:</strong> ${escapeHtml(securityNotes.join(" • "))}</p>
      </aside>
    </section>

    <section class="section">
      <div class="meta-grid">
        <div class="meta-card">
          <h4>Brief</h4>
          <p>${escapeHtml(text(siteBrief.audience, "Local shoppers"))}</p>
          <p>${escapeHtml(text(siteBrief.tone, layoutNotes))}</p>
        </div>
        <div class="meta-card">
          <h4>Visual direction</h4>
          <p>${escapeHtml(colorDescription)}</p>
          <p>${escapeHtml(visualStyle)}</p>
          <p>${escapeHtml(referenceStyle)}</p>
        </div>
        <div class="meta-card">
          <h4>Voice</h4>
          <p>${escapeHtml(toneStyle)}</p>
          <p>${escapeHtml(writingStyle)}</p>
        </div>
        <div class="meta-card">
          <h4>Trust signals</h4>
          <p>${escapeHtml(trustSignals.join(" • "))}</p>
        </div>
        <div class="meta-card">
          <h4>Security by default</h4>
          <p>${escapeHtml(securityNotes.join(" • "))}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="catalog-layout">
        <div>
          <h2 class="section-title">Live catalog</h2>
          <div class="toolbar">
            <input id="search" class="search" type="search" placeholder="Search products" />
          </div>
          <div id="products" class="products">${productsMarkup}</div>
        </div>
        <aside class="cart">
          <h3>Your order</h3>
          <p class="cart-empty" id="cart-empty">No items selected yet.</p>
          <div id="cart-list" class="cart-list"></div>
          <div class="total">
            <span>Total</span>
            <span id="cart-total">KES 0</span>
          </div>
          ${
            whatsappNumber
              ? `<a id="checkout-link" class="cta" href="#" target="_blank" rel="noopener noreferrer">Checkout on WhatsApp</a>`
              : `<button class="cta" disabled>No WhatsApp number configured</button>`
          }
          <button id="copy-summary" class="secondary" type="button">Copy order summary</button>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="meta-grid">
        <div class="meta-card">
          <h4>M-Pesa</h4>
          <p>Use the pay point shown above after confirming your order. Share your transaction code in WhatsApp to speed up fulfilment.</p>
        </div>
        <div class="meta-card">
          <h4>Returns</h4>
          <p>${escapeHtml(returnWindow ? `Eligible returns within ${String(returnWindow)} days where applicable.` : "Return policy is available from the shop after order confirmation.")}</p>
        </div>
        <div class="meta-card">
          <h4>Brand</h4>
          <p>${escapeHtml(shopName)} runs on ${brandName}'s connected retail storefront platform.</p>
        </div>
      </div>
    </section>

    <p class="foot">${brandName} storefront for ${escapeHtml(shopName)}</p>
  </main>
  <script>
    const cart = new Map();
    const shopName = ${JSON.stringify(shopName)};
    const whatsappNumber = ${JSON.stringify(whatsappNumber)};
    const formatter = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });
    const cards = Array.from(document.querySelectorAll('.product-card'));
    const search = document.getElementById('search');
    const cartList = document.getElementById('cart-list');
    const cartEmpty = document.getElementById('cart-empty');
    const cartTotal = document.getElementById('cart-total');
    const checkoutLink = document.getElementById('checkout-link');
    const copySummary = document.getElementById('copy-summary');

    function updateCard(card) {
      const name = card.dataset.name;
      const qty = cart.get(name)?.qty ?? 0;
      card.querySelector('.qty-value').textContent = String(qty);
    }

    function buildSummary() {
      const lines = Array.from(cart.values()).filter(Boolean);
      if (!lines.length) return 'No items selected';
      const total = lines.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const items = lines.map((item) => '- ' + item.name + ' x' + item.qty + ' = ' + formatter.format(item.price * item.qty)).join('%0A');
      return 'Hello ' + shopName + ', I would like to order:%0A' + items + '%0A%0ATotal: ' + formatter.format(total);
    }

    function renderCart() {
      const lines = Array.from(cart.values()).filter((item) => item.qty > 0);
      cartList.innerHTML = lines.map((item) => '<div class="cart-row"><span>' + item.name + ' x' + item.qty + '</span><strong>' + formatter.format(item.price * item.qty) + '</strong></div>').join('');
      cartEmpty.style.display = lines.length ? 'none' : 'block';
      const total = lines.reduce((sum, item) => sum + (item.price * item.qty), 0);
      cartTotal.textContent = formatter.format(total);
      if (checkoutLink) {
        checkoutLink.href = lines.length && whatsappNumber
          ? 'https://wa.me/' + whatsappNumber + '?text=' + buildSummary()
          : '#';
      }
    }

    cards.forEach((card) => {
      const name = card.dataset.name;
      const price = Number(card.dataset.price || '0');
      card.querySelectorAll('.qty-btn').forEach((button) => {
        button.addEventListener('click', () => {
          const existing = cart.get(name) || { name, price, qty: 0 };
          existing.qty = button.dataset.action === 'increase' ? existing.qty + 1 : Math.max(existing.qty - 1, 0);
          cart.set(name, existing);
          updateCard(card);
          renderCart();
        });
      });
      updateCard(card);
    });

    search.addEventListener('input', () => {
      const term = search.value.trim().toLowerCase();
      cards.forEach((card) => {
        const name = (card.dataset.name || '').toLowerCase();
        card.style.display = !term || name.includes(term) ? '' : 'none';
      });
    });

    copySummary.addEventListener('click', async () => {
      const summary = decodeURIComponent(buildSummary().replace(/%0A/g, '\\n'));
      try {
        await navigator.clipboard.writeText(summary);
        copySummary.textContent = 'Copied';
        setTimeout(() => { copySummary.textContent = 'Copy order summary'; }, 1500);
      } catch (_) {}
    });

    renderCart();
  </script>
</body>
</html>`
}

export function setStorefrontSecurityHeaders(res: {
  setHeader(name: string, value: string): unknown
}) {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      "font-src 'self' https: data:",
      "connect-src 'self' https:",
      "form-action https://wa.me https://api.whatsapp.com",
      "upgrade-insecure-requests",
    ].join("; ")
  )
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
}

export function wantsJson(req: MedusaRequest) {
  const format = typeof req.query.format === "string" ? req.query.format : ""
  const accept = String(req.headers.accept ?? "")
  return format === "json" || accept.includes("application/json")
}

function normalizeSlug(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

function extractSubdomain(host?: string | null) {
  const normalizedHost = host?.split(":")[0]?.trim().toLowerCase()
  const root = (process.env.ONLINE_STORE_ROOT_DOMAIN ?? "shops.uzapoint.co.ke")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .toLowerCase()

  if (!normalizedHost || normalizedHost === root) {
    return null
  }

  if (normalizedHost.endsWith(`.${root}`)) {
    return normalizedHost.slice(0, -1 * (`.${root}`.length))
  }

  return null
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function getMap(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim()
  return normalized.length > 0 ? normalized : fallback
}

function formatKes(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function safeHttpsUrl(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) {
    return null
  }

  try {
    const parsed = new URL(raw)
    return parsed.protocol === "https:" ? parsed.toString() : null
  } catch {
    return null
  }
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const strings = value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)

  return strings.length > 0 ? strings.slice(0, 5) : fallback
}
