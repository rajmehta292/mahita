import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchJsonWithTimeout, readJsonResponse } from "@/lib/app-errors"

describe("readJsonResponse", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it("turns hanging requests into a readable timeout error", async () => {
    vi.useFakeTimers()

    try {
      vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
        new Promise((_, reject) => {
          const signal = init?.signal
          signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          }, { once: true })
        })
      )))

      const pending = fetchJsonWithTimeout("/api/trading/market-data?symbol=AAPL&timeframe=1d", {
        timeoutMs: 2_000,
        fallbackMessage: "Failed to load chart data.",
        timeoutMessage: "Market data took too long to load.",
      })

      const expectation = expect(pending).rejects.toMatchObject({
        message: "Market data took too long to load.",
        status: 504,
      })

      await vi.advanceTimersByTimeAsync(2_100)

      await expectation
    } finally {
      vi.useRealTimers()
    }
  })
})
