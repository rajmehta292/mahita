import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/")
}

function buildSignInRedirect(request: NextRequest) {
  const signInUrl = new URL("/auth/signin", request.url)
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
  signInUrl.searchParams.set("callbackUrl", callbackUrl)
  return NextResponse.redirect(signInUrl)
}

export default async function proxy(request: NextRequest) {
  const token = await getToken({ req: request })

  if (token) {
    return NextResponse.next()
  }

  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return buildSignInRedirect(request)
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/portfolio",
    "/portfolio/:path*",
    "/active-trader",
    "/active-trader/:path*",
    "/orders",
    "/orders/:path*",
    "/history",
    "/history/:path*",
    "/watchlist",
    "/watchlist/:path*",
    "/chart",
    "/chart/:path*",
    "/screener",
    "/screener/:path*",
    "/backtest",
    "/backtest/:path*",
    "/trending-indicators",
    "/trending-indicators/:path*",
    "/schwab-data",
    "/schwab-data/:path*",
    "/script-editor",
    "/script-editor/:path*",
    "/settings",
    "/settings/:path*",
    "/ai-chat",
    "/ai-chat/:path*",
    "/desktop-expansion",
    "/desktop-expansion/:path*",
    "/learn",
    "/learn/:path*",
    "/api/trading/:path*",
    "/api/schwab/:path*",
    "/api/user/:path*",
    "/api/ai/:path*"
  ]
}
