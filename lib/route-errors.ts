import { NextResponse } from "next/server"
import { normalizeUnknownError, toAppErrorPayload } from "@/lib/app-errors"

export function toErrorResponse(
  error: unknown,
  fallbackMessage = "Mahita hit an unexpected server error."
) {
  const normalized = normalizeUnknownError(error, fallbackMessage)

  return NextResponse.json(toAppErrorPayload(normalized), {
    status: normalized.status,
  })
}
