import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function extractSlugFromHost(host: string) {
  const normalizedHost = host.split(":")[0].toLowerCase()
  const rootHost = (
    process.env.NEXT_PUBLIC_STOREFRONT_HOST ?? "trace.co.ke"
  ).toLowerCase()

  if (normalizedHost === rootHost || normalizedHost === `www.${rootHost}`) {
    return null
  }

  const suffix = `.${rootHost}`
  if (normalizedHost.endsWith(suffix)) {
    return normalizedHost.slice(0, -1 * suffix.length)
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname.startsWith("/shops/")
  ) {
    return NextResponse.next()
  }

  const slug = extractSlugFromHost(request.headers.get("host") ?? "")
  if (!slug) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = `/shops/${slug}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
