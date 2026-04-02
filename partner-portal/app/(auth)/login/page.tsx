"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { partnerRequest } from "@/lib/partner-api"

export default function LoginPage() {
  const [apiKey, setApiKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await partnerRequest("/partners/auth", { apiKey })
      localStorage.setItem("partner_api_key", apiKey)
      router.push("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-ember">Partner access</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">Secure insight portal</h1>
        <p className="mt-3 text-slate-500">
          Sign in with your issued API key. Access is limited to aggregated, anonymized insight datasets.
        </p>
        <textarea
          className="mt-8 min-h-32 w-full rounded-3xl border border-slate-200 p-4"
          placeholder="Paste partner API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button
          className="mt-6 w-full rounded-2xl bg-ink px-5 py-4 font-medium text-white"
          onClick={() => void handleLogin()}
          disabled={loading}
        >
          {loading ? "Verifying..." : "Enter Portal"}
        </button>
      </div>
    </main>
  )
}
