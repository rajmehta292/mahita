import { describe, expect, it } from "vitest"
import { readJsonResponse } from "@/lib/app-errors"

describe("readJsonResponse", () => {
  it("turns HTML auth redirects into a readable session-expired error", async () => {
    const response = new Response("<!DOCTYPE html><html><body>Sign in</body></html>", {
      status: 401,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    })

    await expect(readJsonResponse(response, "Failed to load chart data.")).rejects.toMatchObject({
      message: "Your session expired. Refresh and sign in again.",
      code: "UNAUTHORIZED",
      status: 401,
    })
  })

  it("passes through JSON payloads when the response is ok", async () => {
    const response = new Response(JSON.stringify({ data: [{ close: 100 }] }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })

    await expect(readJsonResponse<{ data: Array<{ close: number }> }>(response, "Failed.")).resolves.toEqual({
      data: [{ close: 100 }],
    })
  })
})
