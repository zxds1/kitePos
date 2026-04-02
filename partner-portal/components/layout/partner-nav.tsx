"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/data/sales", label: "Sales Data" },
  { href: "/data/products", label: "Product Benchmarks" },
  { href: "/usage", label: "Usage" },
  { href: "/settings", label: "Settings" }
]

export function PartnerNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <aside className="w-full border-b border-slate-200 bg-white md:min-h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="p-6">
        <div className="rounded-2xl bg-ink p-5 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Partner Portal</p>
          <h1 className="mt-2 text-2xl font-semibold">Insight Access</h1>
          <p className="mt-2 text-sm text-slate-300">
            Aggregated exports only. No shop-level or personal data.
          </p>
        </div>
      </div>
      <nav className="space-y-1 px-4 pb-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-xl px-4 py-3 text-sm ${
              pathname === link.href ? "bg-sand font-semibold text-ink" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {link.label}
          </Link>
        ))}
        <button
          className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-600"
          onClick={() => {
            localStorage.removeItem("partner_api_key")
            router.push("/login")
          }}
        >
          Sign out
        </button>
      </nav>
    </aside>
  )
}
