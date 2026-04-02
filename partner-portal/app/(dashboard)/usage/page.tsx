"use client"

import { useEffect, useState } from "react"
import { QuotaMeter } from "@/components/usage/quota-meter"
import { partnerRequest } from "@/lib/partner-api"

type UsageResponse = {
  usage: {
    quota_used: number
    quota_monthly: number
    billing_tier: string
    recent_exports: Array<{
      id: string
      data_type: string
      result_row_count: number
      status: string
      requested_at: string
    }>
  }
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageResponse["usage"] | null>(null)

  useEffect(() => {
    partnerRequest<UsageResponse>("/partners/usage")
      .then((response) => setUsage(response.usage))
      .catch(() => setUsage(null))
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-ink">Usage</h1>
        <p className="mt-2 text-slate-500">Track monthly quota consumption and recent export activity.</p>
      </div>
      <QuotaMeter
        used={usage?.quota_used ?? 0}
        total={usage?.quota_monthly ?? 10000}
        tier={usage?.billing_tier ?? "basic"}
      />
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Recent Activity</h2>
        <div className="mt-4 space-y-3">
          {usage?.recent_exports.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <span className="capitalize">{item.data_type}</span>
                <span className="text-xs uppercase text-slate-500">{item.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{item.result_row_count} rows</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
