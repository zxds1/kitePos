import Link from "next/link"

export function QuickExportCard({
  title = "Quick Export",
  description = "Export a privacy-safe dataset",
  href = "/data/sales"
}: {
  title?: string
  description?: string
  href?: string
}) {
  return (
    <Link href={href} className="rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
      <p className="text-xs uppercase tracking-[0.2em] text-ember">Data access</p>
      <h3 className="mt-3 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </Link>
  )
}
