import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isTrackableAuthenticatedPath } from "@/lib/auth-redirect"
import { upsertUserPreferences } from "@/lib/user-preferences"

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const path = typeof body?.path === "string" ? body.path : null

    if (!isTrackableAuthenticatedPath(path)) {
        return NextResponse.json({ success: true, ignored: true })
    }

    await upsertUserPreferences(session.user.id, {
        lastVisitedPath: path,
        lastVisitedAt: new Date(),
    })

    return NextResponse.json({ success: true })
}
