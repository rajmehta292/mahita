import { NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import { getScreenerConfig } from "@/lib/screener/service"

export async function GET() {
  const session = await getAppServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getScreenerConfig(session.user.id)
  return NextResponse.json({ success: true, ...config })
}
