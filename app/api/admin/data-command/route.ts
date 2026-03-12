import { NextResponse } from "next/server"
import { requireRouteAccess } from "@/lib/security/platform-security"
import { getDataCommandSnapshot } from "@/lib/admin-control-plane"
import { toErrorResponse } from "@/lib/route-errors"

export async function GET() {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const snapshot = await getDataCommandSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    return toErrorResponse(error, "Mahita could not load the Data Command console.")
  }
}
