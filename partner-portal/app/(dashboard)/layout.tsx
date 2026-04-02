"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PartnerNav } from "@/components/layout/partner-nav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (!localStorage.getItem("partner_api_key")) {
      router.push("/login")
    }
  }, [router])

  return (
    <div className="md:flex">
      <PartnerNav />
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  )
}
