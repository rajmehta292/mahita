import type { Prisma, User } from "@prisma/client"
import { Session, getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isSuperuserRole } from "@/lib/roles"

const RECOVERABLE_SESSION_ERROR_PATTERNS = [
    "JWT_SESSION_ERROR",
    "decryption operation failed",
    "JWEDecryptionFailed",
    "no matching decryption secret",
]

export function isRecoverableSessionError(error: unknown) {
    if (!(error instanceof Error)) {
        return false
    }

    const haystack = `${error.name} ${error.message}`.toLowerCase()
    return RECOVERABLE_SESSION_ERROR_PATTERNS.some((pattern) =>
        haystack.includes(pattern.toLowerCase())
    )
}

export async function getAppServerSession(): Promise<Session | null> {
    try {
        return await getServerSession(authOptions)
    } catch (error) {
        if (isRecoverableSessionError(error)) {
            console.warn(
                "[auth] Recoverable session error while reading NextAuth session; treating request as signed out.",
                error instanceof Error ? { name: error.name, message: error.message } : error
            )
            return null
        }

        throw error
    }
}

export async function getCurrentUser(
    session: Session,
    options?: { include?: Prisma.UserInclude }
): Promise<
    | User
    | Prisma.UserGetPayload<{ include: Prisma.UserInclude }>
    | null
> {
    if (session.user?.id) {
        return prisma.user.findUnique({
            where: { id: session.user.id },
            include: options?.include,
        })
    }

    if (!session.user?.email) {
        return null
    }

    return prisma.user.findUnique({
        where: { email: session.user.email },
        include: options?.include,
    })
}

export async function getCurrentUserWithSchwabConfig(session: Session) {
    if (session.user?.id) {
        return prisma.user.findUnique({
            where: { id: session.user.id },
            include: { schwabConfig: true },
        })
    }

    if (!session.user?.email) {
        return null
    }

    return prisma.user.findUnique({
        where: { email: session.user.email },
        include: { schwabConfig: true },
    })
}

export async function getCurrentUserWithBrokerageConnections(session: Session) {
    if (session.user?.id) {
        return prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                brokerageConnections: {
                    include: {
                        linkedSchwabConfig: true,
                        accounts: {
                            where: { isActive: true },
                            orderBy: [{ updatedAt: "desc" }],
                        },
                    },
                },
            },
        })
    }

    if (!session.user?.email) {
        return null
    }

    return prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            brokerageConnections: {
                include: {
                    linkedSchwabConfig: true,
                    accounts: {
                        where: { isActive: true },
                        orderBy: [{ updatedAt: "desc" }],
                    },
                },
            },
        },
    })
}

export function isSuperuserSession(session: Session | null | undefined) {
    return isSuperuserRole(session?.user?.role)
}
