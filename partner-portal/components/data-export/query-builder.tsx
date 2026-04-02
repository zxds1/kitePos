"use client"

import { useState } from "react"
import { PARTNER_EXPORT_NOTICE } from "@/lib/privacy-rules"

type Query = {
  start_date: string
  end_date: string
  regions: string[]
  group_by: "region" | "ward" | "category"
  format: "json" | "csv"
}

export function QueryBuilder({
  availableRegions,
  onExport
}: {
  availableRegions: string[]
  onExport: (query: Query) => void
}) {
  const [query, setQuery] = useState<Query>({
    start_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    regions: availableRegions.slice(0, 1),
    group_by: "region",
    format: "json"
  })

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Start date</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            type="date"
            value={query.start_date}
            onChange={(e) => setQuery({ ...query, start_date: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">End date</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            type="date"
            value={query.end_date}
            onChange={(e) => setQuery({ ...query, end_date: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium text-slate-700">Regions</label>
        <div className="mt-3 flex flex-wrap gap-2">
          {availableRegions.map((region) => {
            const selected = query.regions.includes(region)
            return (
              <button
                key={region}
                className={`rounded-full px-4 py-2 text-sm ${selected ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={() =>
                  setQuery({
                    ...query,
                    regions: selected
                      ? query.regions.filter((item) => item !== region)
                      : [...query.regions, region]
                  })
                }
              >
                {region}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Group by</label>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            value={query.group_by}
            onChange={(e) => setQuery({ ...query, group_by: e.target.value as Query["group_by"] })}
          >
            <option value="region">Region</option>
            <option value="ward">Ward</option>
            <option value="category">Category</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Format</label>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            value={query.format}
            onChange={(e) => setQuery({ ...query, format: e.target.value as Query["format"] })}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
      </div>

      <button
        className="mt-6 w-full rounded-2xl bg-ember px-5 py-4 font-medium text-white"
        onClick={() => onExport(query)}
      >
        Export Data
      </button>

      <p className="mt-4 text-sm text-slate-500">{PARTNER_EXPORT_NOTICE}</p>
    </div>
  )
}
