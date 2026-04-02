export function QuotaMeter({
  used,
  total,
  tier
}: {
  used: number
  total: number
  tier: string
}) {
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">Monthly quota</p>
      <h3 className="mt-2 text-3xl font-semibold text-ink">{used} / {total}</h3>
      <div className="mt-4 h-3 rounded-full bg-slate-100">
        <div
          className="h-3 rounded-full bg-moss"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-500">Tier: {tier}</p>
    </div>
  )
}
