import { redirect } from "next/navigation"
import { AdminControlPlane } from "@/app/components/Admin/AdminControlPlane"
import { getAppServerSession, isSuperuserSession } from "@/lib/server-session"

export default async function AdminPage() {
  const session = await getAppServerSession()

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  if (!isSuperuserSession(session)) {
    redirect("/dashboard")
  }

  return <AdminControlPlane />
}

