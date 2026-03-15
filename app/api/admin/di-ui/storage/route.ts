import { NextRequest, NextResponse } from "next/server"
import { requireRouteAccess } from "@/lib/security/platform-security"
import { getDiUiStorageSnapshot } from "@/lib/admin-di-ui"
import { toErrorResponse } from "@/lib/route-errors"

export async function GET(request: NextRequest) {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const { searchParams } = new URL(request.url)
    const snapshot = await getDiUiStorageSnapshot({
      symbol: searchParams.get("symbol"),
      timeframe: searchParams.get("timeframe"),
      vaultName: searchParams.get("vault"),
      verificationStatus: searchParams.get("verificationStatus"),
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "50"),
    })
    return NextResponse.json(snapshot)
  } catch (error) {
    return toErrorResponse(error, "Mahita could not load the DI-UI storage view.")
  }
}
