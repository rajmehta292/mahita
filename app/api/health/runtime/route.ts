import { NextResponse } from "next/server"
import { getRuntimeHealthSnapshot } from "@/lib/runtime-health"
import { toErrorResponse } from "@/lib/route-errors"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const health = await getRuntimeHealthSnapshot()
    return NextResponse.json(health, {
      status: health.ok ? 200 : 503,
    })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not determine runtime health.")
  }
}
