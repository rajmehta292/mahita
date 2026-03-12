import { redirect } from "next/navigation"
import { SignInCard } from "@/app/components/Auth/SignInCard"
import { getAppServerSession } from "@/lib/server-session"

interface SignInPageProps {
    searchParams: Promise<{
        error?: string | string[]
    }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
    const session = await getAppServerSession()
    if (session?.user?.id) {
        redirect("/auth/post-signin")
    }

    const params = await searchParams
    const errorCode = Array.isArray(params.error) ? params.error[0] : params.error ?? null

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0d0e12] p-6">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute left-[-10%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-indigo-500/10 blur-[140px]" />
                <div className="absolute bottom-[-12%] right-[-12%] h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-[140px]" />
            </div>
            <div className="relative z-10">
                <SignInCard authErrorCode={errorCode} />
            </div>
        </div>
    )
}
