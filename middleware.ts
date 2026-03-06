import { withAuth } from "next-auth/middleware"

export default withAuth({
    callbacks: {
        authorized({ req, token }) {
            // Require authenticated session for all matched routes
            return !!token
        },
    },
})

export const config = {
    matcher: [
        "/dashboard",
        "/dashboard/:path*",
        "/api/trading/:path*"
    ]
}
