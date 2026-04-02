import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Partner Portal",
  description: "Secure access to aggregated retail insight exports"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
