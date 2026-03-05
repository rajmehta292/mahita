import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "MOCK_CLIENT_SECRET",
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!ALLOWED_EMAIL || user.email !== ALLOWED_EMAIL) {
                // Reject login if email is not the single owner
                console.warn(`Unauthorized login attempt by: ${user.email}`)
                return false
            }
            return true
        },
        async session({ session, user }) {
            // Pass the user id to the session for relations
            if (session.user) {
                session.user.id = user.id
            }
            return session
        }
    },
    session: {
        strategy: "database",
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
