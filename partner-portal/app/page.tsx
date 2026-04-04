import Link from "next/link"

export default function HomePage() {
  return (
    <main className="surface-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl rounded-4xl border border-trace-line bg-white/90 p-10 shadow-panel backdrop-blur">
          <p className="mb-4 inline-flex rounded-full bg-trace-mist px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-trace-blue">
            Trace Commerce
          </p>
          <h1 className="text-5xl font-black tracking-tight text-trace-deep">
            Real storefronts for shops running on Trace
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Open a shop link to browse live stock, add products to cart, and complete
            checkout with merchant-provided payment instructions.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/shops/demo"
              className="rounded-2xl bg-trace-blue px-6 py-3 font-semibold text-white"
            >
              Open demo storefront
            </Link>
            <a
              href="https://trace.co.ke"
              className="rounded-2xl border border-trace-line px-6 py-3 font-semibold text-trace-deep"
            >
              Trace main site
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
