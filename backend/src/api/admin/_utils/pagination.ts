const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type CursorPayload = {
  offset: number
}

export function parseLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.max(limit, 1), MAX_LIMIT)
}

export function decodeCursor(cursor?: string): number {
  if (!cursor) {
    return 0
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8")
    ) as CursorPayload

    if (typeof decoded.offset !== "number" || decoded.offset < 0) {
      return 0
    }

    return decoded.offset
  } catch {
    return 0
  }
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf-8").toString("base64url")
}

export function buildCursorPage(
  count: number,
  limit: number,
  offset: number
) {
  const nextOffset = offset + limit

  return {
    limit,
    count,
    next_cursor: nextOffset < count ? encodeCursor(nextOffset) : null,
  }
}
