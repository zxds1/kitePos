"use client"

import { useEffect, useState } from "react"
import { partnerRequest } from "@/lib/partner-api"

type PartnerAuthResponse = {
  partner: {
    name: string
    api_key_last4?: string | null
    permissions?: {
      regions?: string[]
      data_types?: string[]
    }
  }
}

export default function SettingsPage() {
  const [partner, setPartner] = useState<PartnerAuthResponse["partner"] | null>(null)

  useEffect(() => {
    partnerRequest<PartnerAuthResponse>("/partners/auth")
      .then((response) => setPartner(response.partner))
      .catch(() => setPartner(null))
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-semibold text-ink">Settings</h1>
        <p className="mt-2 text-slate-500">View issued credential metadata and granted data permissions.</p>
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Organization</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{partner?.name ?? "Partner"}</h2>
        <p className="mt-4 text-sm text-slate-500">API key last 4</p>
        <code className="mt-2 inline-block rounded-full bg-slate-100 px-4 py-2">
          {partner?.api_key_last4 ?? "unknown"}
        </code>
        <div className="mt-6">
          <p className="text-sm text-slate-500">Regions</p>
          <p className="mt-2">{partner?.permissions?.regions?.join(", ") || "None"}</p>
        </div>
        <div className="mt-6">
          <p className="text-sm text-slate-500">Data types</p>
          <p className="mt-2">{partner?.permissions?.data_types?.join(", ") || "None"}</p>
        </div>
      </div>
    </div>
  )
}
