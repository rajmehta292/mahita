import { NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import { deleteScreenerPreset } from "@/lib/screener/service"

interface Context {
  params: Promise<{ id: string }>
}

export async function DELETE(_: Request, context: Context) {
  const session = await getAppServerSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params
  await deleteScreenerPreset(session.user.id, id)
  return NextResponse.json({ success: true })
}
