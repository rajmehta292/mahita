import { redirect } from "next/navigation"
import { LandingExperience } from "@/app/components/Landing/LandingExperience"
import { resolveSignedInHomePath } from "@/lib/auth-redirect"
import { getAppServerSession } from "@/lib/server-session"
import { getUserPreferences } from "@/lib/user-preferences"

export default async function HomePage() {
    const session = await getAppServerSession()

    if (session?.user?.id) {
        const preferences = await getUserPreferences(session.user.id)
        redirect(resolveSignedInHomePath({
            lastVisitedPath: preferences?.lastVisitedPath,
            lastSignInAt: preferences?.lastSignInAt,
        }))
    }

    return <LandingExperience />
}
