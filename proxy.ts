import { withAuth } from "next-auth/middleware"

export default withAuth({
    pages: {
        signIn: "/auth/signin",
    },
    callbacks: {
        authorized({ token }) {
            return !!token
        },
    },
})

export const config = {
    matcher: [
        "/dashboard",
        "/dashboard/:path*",
        "/portfolio",
        "/portfolio/:path*",
        "/active-trader",
        "/active-trader/:path*",
        "/orders",
        "/orders/:path*",
        "/history",
        "/history/:path*",
        "/watchlist",
        "/watchlist/:path*",
        "/chart",
        "/chart/:path*",
        "/screener",
        "/screener/:path*",
        "/backtest",
        "/backtest/:path*",
        "/trending-indicators",
        "/trending-indicators/:path*",
        "/schwab-data",
        "/schwab-data/:path*",
        "/script-editor",
        "/script-editor/:path*",
        "/settings",
        "/settings/:path*",
        "/ai-chat",
        "/ai-chat/:path*",
        "/desktop-expansion",
        "/desktop-expansion/:path*",
        "/learn",
        "/learn/:path*",
        "/api/trading/:path*",
        "/api/schwab/:path*",
        "/api/user/:path*",
        "/api/ai/:path*"
    ]
}
