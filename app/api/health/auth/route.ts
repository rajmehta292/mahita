import { NextResponse } from "next/server"
import {
    getAuthHealthSnapshotForOrigin,
    getRequestOriginFromHeaders,
} from "@/lib/auth-environment"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const requestOrigin = getRequestOriginFromHeaders(request.headers)
    const health = getAuthHealthSnapshotForOrigin(requestOrigin)

    return NextResponse.json({
        ok:
            health.hasNextAuthSecret &&
            health.usesSafeLocalOrigin &&
            (health.googleSignInEnabled || health.devBypassEnabled),
        ...health,
        errorPagePath: "/auth/error",
        signInPath: "/auth/signin",
    })
}
