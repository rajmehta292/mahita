import { beforeEach, describe, expect, it, vi } from "vitest"

const { getServerSessionMock } = vi.hoisted(() => ({
    getServerSessionMock: vi.fn(),
}))

vi.mock("next-auth", () => ({
    getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
    authOptions: {},
}))

vi.mock("@/lib/prisma", () => ({
    default: {},
}))

import { getAppServerSession, isRecoverableSessionError } from "@/lib/server-session"

describe("server-session", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("recognizes stale encrypted-session errors as recoverable", () => {
        expect(
            isRecoverableSessionError(
                new Error('[next-auth][error][JWT_SESSION_ERROR] "decryption operation failed"')
            )
        ).toBe(true)
        expect(isRecoverableSessionError(new Error("something else"))).toBe(false)
        expect(isRecoverableSessionError({ message: "decryption operation failed" })).toBe(false)
    })

    it("returns null when NextAuth throws a recoverable stale-session error", async () => {
        getServerSessionMock.mockRejectedValueOnce(
            new Error('[next-auth][error][JWT_SESSION_ERROR] "decryption operation failed"')
        )

        await expect(getAppServerSession()).resolves.toBeNull()
    })

    it("rethrows non-session errors", async () => {
        getServerSessionMock.mockRejectedValueOnce(new Error("database unavailable"))

        await expect(getAppServerSession()).rejects.toThrow("database unavailable")
    })
})
