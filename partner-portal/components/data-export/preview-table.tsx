export function PreviewTable({
  rows
}: {
  rows: Array<Record<string, unknown>>
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
        No data preview yet.
      </div>
    )
  }

  const columns = Object.keys(rows[0])

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-100">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3 text-sm text-slate-700">
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
