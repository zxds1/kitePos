import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Trace Storefront",
  description: "Live ecommerce storefronts powered by Trace.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
