"use client"

import { useEffect, useState } from "react"
import { partnerRequest } from "@/lib/partner-api"

type UsageResponse = {
  usage: {
    recent_exports: Array<{
      id: string
      data_type: string
      requested_at: string
      result_row_count: number
      status: string
      format: string
    }>
  }
}

export function RecentExports() {
  const [exports, setExports] = useState<UsageResponse["usage"]["recent_exports"]>([])

  useEffect(() => {
    partnerRequest<UsageResponse>("/partners/usage")
      .then((response) => setExports(response.usage.recent_exports))
      .catch(() => setExports([]))
  }, [])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-ink">Recent Exports</h3>
      <div className="mt-4 space-y-3">
        {exports.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">{item.data_type}</span>
              <span className="text-xs uppercase text-slate-500">{item.format}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{item.result_row_count} rows</p>
            <p className="mt-1 text-xs text-slate-400">{new Date(item.requested_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
