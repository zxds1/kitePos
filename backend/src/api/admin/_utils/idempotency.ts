type DatabaseErrorLike = {
  code?: unknown
  message?: unknown
}

export function isPostgresUniqueViolation(
  error: unknown
): error is DatabaseErrorLike & { code: "23505" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  )
}

export function isRetryableSyncError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as DatabaseErrorLike).code ?? "")
      : ""

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as DatabaseErrorLike).message ?? "").toLowerCase()
      : String(error ?? "").toLowerCase()

  return (
    ["40001", "40p01", "55p03", "57014", "53300"].includes(code.toLowerCase()) ||
    message.includes("lock") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    message.includes("temporarily unavailable")
  )
}
