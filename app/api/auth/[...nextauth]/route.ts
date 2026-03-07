import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

const ALLOWED_EMAILS = ['raj.dmehta292@gmail.com', 'dh.mehta@gmail.com']

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "MOCK_CLIENT_SECRET",
        }),
        ...(process.env.NODE_ENV === 'development' ? [
            CredentialsProvider({
                name: "Development Login",
                credentials: {
                    email: { label: "Email", type: "text", placeholder: "dev@mahita.ai" },
                    password: { label: "Password", type: "password" }
                },
                async authorize(credentials) {
                    const email = credentials?.email || "dev@mahita.ai"
                    let user = await prisma.user.findUnique({ where: { email } })
                    if (!user) {
                        user = await prisma.user.create({ data: { email, name: 'Dev User' } })
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
            console.log(`SignIn attempt: email=${user.email}, provider=${account?.provider}`)
            if (account?.provider === 'credentials' && process.env.NODE_ENV === 'development') {
                return true
            }
            if (!user.email || !ALLOWED_EMAILS.includes(user.email)) {
                console.warn(`Unauthorized login attempt by: ${user.email}`)
                return false
            }
            console.log(`Authorized login: ${user.email}`)
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
    },
    debug: true,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }