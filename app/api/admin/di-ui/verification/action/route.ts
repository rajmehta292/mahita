import { NextRequest, NextResponse } from "next/server"
import { requireRouteAccess } from "@/lib/security/platform-security"
import { runDiUiAction } from "@/lib/admin-di-ui"
import { toErrorResponse } from "@/lib/route-errors"

export async function POST(request: NextRequest) {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action === "run-after-hours-verification"
      ? "run-after-hours-verification"
      : "run-repeat-verification"

    const result = await runDiUiAction({
      action,
      actorUserId: access.userId!,
      profileId: typeof body.profileId === "string" ? body.profileId : undefined,
      provider: typeof body.provider === "string" ? body.provider : null,
      verificationMode: typeof body.verificationMode === "string" ? body.verificationMode : undefined,
      symbol: typeof body.symbol === "string" ? body.symbol : undefined,
      timeframe: typeof body.timeframe === "string" ? body.timeframe : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    return toErrorResponse(error, "Mahita could not complete the DI-UI verification action.")
  }
}
