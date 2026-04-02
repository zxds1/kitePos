export function ExportButton({
  loading,
  onClick,
  label = "Download export"
}: {
  loading?: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      className="rounded-2xl bg-ink px-5 py-3 font-medium text-white disabled:opacity-60"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "Preparing..." : label}
    </button>
  )
}
