import Link from "next/link"

export default function NotFound() {
  return (
    <main className="surface-grid flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl rounded-4xl border border-trace-line bg-white p-10 text-center shadow-panel">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
          Trace storefront
        </p>
        <h1 className="mt-4 text-4xl font-black text-trace-deep">
          Store not found
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          The storefront link may be invalid, inactive, or not yet published.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-2xl bg-trace-blue px-6 py-3 font-semibold text-white"
        >
          Return home
        </Link>
      </div>
    </main>
  )
}
