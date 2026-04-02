"use client"

import { useEffect, useState } from "react"
import { partnerRequest } from "@/lib/partner-api"
import { QuotaMeter } from "@/components/usage/quota-meter"
import { QuickExportCard } from "@/components/data-export/quick-export-card"
import { RecentExports } from "@/components/data-export/recent-exports"

type PartnerAuthResponse = {
  partner: {
    name: string
    billing_tier: string
    quota_used: number
    quota_monthly: number
    permissions?: {
      data_types?: string[]
    }
  }
}

export default function PartnerDashboard() {
  const [partner, setPartner] = useState<PartnerAuthResponse["partner"] | null>(null)

  useEffect(() => {
    partnerRequest<PartnerAuthResponse>("/partners/auth")
      .then((response) => setPartner(response.partner))
      .catch(() => setPartner(null))
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Dashboard</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          Welcome{partner?.name ? `, ${partner.name}` : ""}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-500">
          Access aggregated retail insights while staying inside ODPC-aligned privacy boundaries.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <QuotaMeter
          used={partner?.quota_used ?? 0}
          total={partner?.quota_monthly ?? 10000}
          tier={partner?.billing_tier ?? "basic"}
        />
        <QuickExportCard
          title="Launch Sales Export"
          description="Download region, ward, or category-level trend data."
          href="/data/sales"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {partner?.permissions?.data_types?.includes("sales") ? (
          <QuickExportCard
            title="Sales Trends"
            description="Aggregated revenue, transactions, and payment mix."
            href="/data/sales"
          />
        ) : null}
        {partner?.permissions?.data_types?.includes("products") ? (
          <QuickExportCard
            title="Product Benchmarks"
            description="Median price and sales velocity across permitted regions."
            href="/data/products"
          />
        ) : null}
        <QuickExportCard
          title="Usage & Billing"
          description="Review quota consumption and recent export activity."
          href="/usage"
        />
      </div>

      <RecentExports />
    </div>
  )
}
