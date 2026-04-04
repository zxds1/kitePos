import { notFound } from "next/navigation"
import { StorefrontClient } from "@/components/storefront-client"
import {
  asMap,
  getAccentColor,
  getStoreText,
  getStorefront,
} from "@/lib/storefront"

type PageProps = {
  params: {
    slug: string
  }
}

export default async function ShopStorefrontPage({ params }: PageProps) {
  const storefront = await getStorefront(params.slug)
  if (!storefront) {
    notFound()
  }

  const accentColor = getAccentColor(storefront.store)
  const shop = storefront.shop
  const store = storefront.store
  const heroTitle = getStoreText(
    store,
    "hero_title",
    `${String(shop.shop_name ?? "Trace Shop")} online`
  )
  const heroSubtitle = getStoreText(
    store,
    "hero_subtitle",
    "Browse live products, add items to cart, and checkout with the merchant."
  )
  const sharing = asMap(store.sharing_metadata)
  const seo = asMap(store.seo_metadata)

  return (
    <main className="surface-grid min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <section
          className="overflow-hidden rounded-[36px] border border-white/20 px-6 py-8 text-white shadow-panel md:px-10 md:py-10"
          style={{
            background: `linear-gradient(135deg, #102330 0%, ${accentColor} 100%)`,
          }}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_360px]">
            <div>
              <p className="inline-flex rounded-full bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/80">
                Powered by Trace
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/82 md:text-lg">
                {heroSubtitle}
              </p>
              {sharing.whatsapp_text ? (
                <p className="mt-6 text-sm text-white/72">
                  {String(sharing.whatsapp_text)}
                </p>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                Merchant details
              </p>
              <h2 className="mt-3 text-2xl font-black">
                {String(shop.shop_name ?? "Trace Shop")}
              </h2>
              <div className="mt-5 space-y-3 text-sm text-white/85">
                {shop.address ? <p>{String(shop.address)}</p> : null}
                {shop.region_code || shop.ward_code ? (
                  <p>
                    {[shop.ward_code, shop.region_code].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                {shop.mpesa_display_name ? (
                  <p>M-Pesa name: {String(shop.mpesa_display_name)}</p>
                ) : null}
                {seo.description ? <p>{String(seo.description)}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <StorefrontClient storefront={storefront} accentColor={accentColor} />
        </section>
      </div>
    </main>
  )
}
