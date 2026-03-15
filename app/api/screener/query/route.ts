import { NextRequest, NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import { queryScreener } from "@/lib/screener/service"
import type { ScreenerQueryRequest } from "@/lib/screener/types"

export async function POST(request: NextRequest) {
  const session = await getAppServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as Partial<ScreenerQueryRequest>
  const query: ScreenerQueryRequest = {
    groupTab: body.groupTab || "descriptive",
    resultTab: body.resultTab || "overview",
    orderKey: body.orderKey || "symbol",
    orderDirection: body.orderDirection === "desc" ? "desc" : "asc",
    signal: body.signal || "none",
    tickerQuery: body.tickerQuery || "",
    filters: Array.isArray(body.filters) ? body.filters : [],
    page: Math.max(1, Number(body.page || 1)),
    pageSize: Math.max(10, Math.min(100, Number(body.pageSize || 20))),
  }

  const result = await queryScreener(session.user.id, query)
  return NextResponse.json({ success: true, ...result })
}
