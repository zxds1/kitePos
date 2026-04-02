export function asNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (
    value &&
    typeof value === "object" &&
    "value" in (value as Record<string, unknown>)
  ) {
    return asNumber((value as { value?: unknown }).value)
  }

  return 0
}

export function formatBucketDate(
  value: Date,
  groupBy: "day" | "week" | "month"
): string {
  const date = new Date(value)

  if (groupBy === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
  }

  if (groupBy === "week") {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
    const day = start.getUTCDay() || 7
    start.setUTCDate(start.getUTCDate() - day + 1)
    return start.toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

export function toCsv(rows: Array<Record<string, unknown>>, fields: string[]) {
  const escape = (value: unknown) => {
    const normalized =
      value instanceof Date
        ? value.toISOString()
        : value == null
          ? ""
          : String(value)

    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`
    }

    return normalized
  }

  return [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => escape(row[field])).join(",")),
  ].join("\n")
}
