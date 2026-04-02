"use client"

import { useState } from "react"
import { QueryBuilder } from "@/components/data-export/query-builder"
import { PreviewTable } from "@/components/data-export/preview-table"
import { partnerRequest } from "@/lib/partner-api"

type SalesResponse = {
  data: Array<Record<string, unknown>>
}

const regions = ["NAI", "KSM", "MSA", "NKR", "ELD"]

export default function SalesDataPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)

  const handleExport = async (query: {
    start_date: string
    end_date: string
    regions: string[]
    group_by: "region" | "ward" | "category"
    format: "json" | "csv"
  }) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: new Date(query.start_date).toISOString(),
        end_date: new Date(query.end_date).toISOString(),
        group_by: query.group_by,
        format: query.format,
        regions: query.regions.join(",")
      })
      const response = await partnerRequest<SalesResponse>(`/partners/data/sales?${params.toString()}`)
      setRows(response.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-ink">Sales Data Export</h1>
        <p className="mt-2 text-slate-500">Build a privacy-safe sales extract across your authorized regions.</p>
      </div>
      <QueryBuilder availableRegions={regions} onExport={handleExport} />
      {loading ? <div className="rounded-3xl bg-white p-6 shadow-sm">Loading preview...</div> : null}
      <PreviewTable rows={rows} />
    </div>
  )
}
