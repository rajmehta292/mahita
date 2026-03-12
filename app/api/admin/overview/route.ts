import { NextResponse } from "next/server"
import { requireRouteAccess } from "@/lib/security/platform-security"
import { getAdminOverview } from "@/lib/admin-control-plane"
import { toErrorResponse } from "@/lib/route-errors"

export async function GET() {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const overview = await getAdminOverview()
    return NextResponse.json(overview)
  } catch (error) {
    return toErrorResponse(error, "Mahita could not load the admin overview.")
  }
}
