import { redirect } from "next/navigation"
import { AUTH_POST_SIGNIN_PATH, resolvePostSignInPath } from "@/lib/auth-redirect"
import { getAppServerSession } from "@/lib/server-session"
import { getUserPreferences } from "@/lib/user-preferences"

export default async function AuthPostSignInPage() {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        redirect("/auth/signin")
    }

    const preferences = await getUserPreferences(session.user.id)
    const destination = resolvePostSignInPath({
        lastVisitedPath: preferences?.lastVisitedPath,
        previousSignInAt: preferences?.previousSignInAt,
    })

    if (destination === AUTH_POST_SIGNIN_PATH) {
        redirect("/dashboard")
    }

    redirect(destination)
}
