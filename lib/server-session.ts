import type { Prisma, User } from "@prisma/client"
import { Session, getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isSuperuserRole } from "@/lib/roles"

export async function getAppServerSession(): Promise<Session | null> {
    return getServerSession(authOptions)
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
