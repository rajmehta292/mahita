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
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async signIn({ user }) {
            console.log(`SignIn attempt: email=${user.email}, allowed=${ALLOWED_EMAIL}`)
            if (!ALLOWED_EMAIL || user.email !== ALLOWED_EMAIL) {
                console.warn(`Unauthorized login attempt by: ${user.email}`)
                return false
            }
            return true
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                ; (session.user as any).id = token.id
            }
            return session
        }
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
