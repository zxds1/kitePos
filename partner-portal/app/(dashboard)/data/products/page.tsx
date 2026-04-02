"use client"

import { useState } from "react"
import { PreviewTable } from "@/components/data-export/preview-table"
import { ExportButton } from "@/components/data-export/export-button"
import { partnerRequest } from "@/lib/partner-api"

type ProductResponse = {
  data: Array<Record<string, unknown>>
}

export default function ProductBenchmarksPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)

  const loadBenchmarks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
        end_date: new Date().toISOString()
      })
      const response = await partnerRequest<ProductResponse>(`/partners/data/products?${params.toString()}`)
      setRows(response.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-ink">Product Benchmarks</h1>
        <p className="mt-2 text-slate-500">Median price and sales velocity across consented, aggregated datasets.</p>
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <ExportButton loading={loading} onClick={() => void loadBenchmarks()} label="Load benchmarks" />
      </div>
      <PreviewTable rows={rows} />
    </div>
  )
}
