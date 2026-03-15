import { NextRequest, NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import { globalSearch } from "@/lib/screener/service"

export async function GET(request: NextRequest) {
  const session = await getAppServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get("q") || ""
  const groups = await globalSearch(session.user.id, query)

  return NextResponse.json({
    success: true,
    groups,
  })
}
