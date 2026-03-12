import { NextAuthOptions } from "next-auth"
import type { UserRole as PrismaUserRole } from "@prisma/client"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"
import {
    isGoogleAuthEnabled,
    getRequestOriginFromHeaders,
    isLocalhostOrigin,
    normalizeAuthEnvironment,
} from "@/lib/auth-environment"
import { DEFAULT_APP_ROLE, type AppRole } from "@/lib/roles"
import { resolvePersistedAppRole } from "@/lib/auth-policy"
import { scrubUnusedOAuthAccountTokens } from "@/lib/security/platform-security"
import { upsertUserPreferences } from "@/lib/user-preferences"

normalizeAuthEnvironment()

export const GOOGLE_PROVIDER_OPTIONS = {
    allowDangerousEmailAccountLinking: true,
} as const

function isDevBypassEnabled() {
    return process.env.ENABLE_DEV_AUTH_BYPASS === 'true'
}

function isLocalDevBypassRequest(
    request?: Pick<{ headers?: Record<string, string | string[] | undefined> }, "headers"> | null
) {
    const requestOrigin = getRequestOriginFromHeaders(request?.headers ?? null)
    return Boolean(requestOrigin && isLocalhostOrigin(requestOrigin))
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        ...(isGoogleAuthEnabled()
            ? [
                GoogleProvider({
                    clientId: process.env.GOOGLE_CLIENT_ID!,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                    ...GOOGLE_PROVIDER_OPTIONS,
                }),
            ]
            : []),
        ...(isDevBypassEnabled() ? [
            CredentialsProvider({
                name: "Development Login",
                credentials: {
                    email: { label: "Email", type: "text", placeholder: "dev@mahita.ai" },
                    password: { label: "Password", type: "password" }
                },
                async authorize(credentials, request) {
                    if (!isLocalDevBypassRequest(request)) {
                        return null
                    }

                    const email = credentials?.email || "dev@mahita.ai"
                    let user = await prisma.user.findUnique({ where: { email } })
                    if (!user) {
                        user = await prisma.user.create({
                            data: {
                                email,
                                name: 'Dev User',
                                role: resolvePersistedAppRole({ email }) as PrismaUserRole,
                            }
                        })
                    }
                    return user
                }
            })
        ] : []),
    ],
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === 'credentials' && isDevBypassEnabled()) {
                return true
            }

            if (!user.email) {
                return false
            }

            if (user.id) {
                const existingUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { role: true, email: true },
                })

                const role = resolvePersistedAppRole({
                    persistedRole: existingUser?.role ?? user.role,
                    email: existingUser?.email ?? user.email,
                })

                if (existingUser && existingUser.role !== role) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { role: role as PrismaUserRole }
                    })
                }
            }

            return true
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = resolvePersistedAppRole({
                    persistedRole: user.role,
                    email: user.email,
                })
            } else if (token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { email: true, role: true }
                })

                if (dbUser) {
                    const normalizedRole = resolvePersistedAppRole({
                        persistedRole: dbUser.role,
                        email: dbUser.email,
                    })
                    token.role = normalizedRole

                    if (dbUser.role !== normalizedRole) {
                        await prisma.user.update({
                            where: { id: token.id as string },
                            data: { role: normalizedRole as PrismaUserRole }
                        })
                    }
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = String(token.id ?? "")
                session.user.role = (token.role as AppRole | undefined) ?? DEFAULT_APP_ROLE
            }
            return session
        },
    },
    events: {
        async signIn({ user, account }) {
            if (!user.id) {
                return
            }

            const existingPreferences = await prisma.userPreference.findUnique({
                where: { userId: user.id },
                select: { lastSignInAt: true }
            })

            await upsertUserPreferences(user.id, {
                previousSignInAt: existingPreferences?.lastSignInAt ?? null,
                lastSignInAt: new Date(),
            })

            if (account?.provider === "google") {
                await scrubUnusedOAuthAccountTokens({
                    userId: user.id,
                    provider: account.provider,
                })
            }
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    debug: process.env.NEXTAUTH_DEBUG === 'true',
}
