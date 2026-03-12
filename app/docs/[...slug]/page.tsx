import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"
import { DocsArticle } from "@/app/components/Docs/DocsArticle"
import { DocsShell } from "@/app/components/Docs/DocsShell"
import { getDocBySlug } from "@/lib/docs"
import { getAppServerSession } from "@/lib/server-session"

export default async function DocumentationDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const session = await getAppServerSession()
  const signedIn = Boolean(session?.user?.id)
  const resolved = await getDocBySlug(slug, signedIn)

  if (!resolved) {
    notFound()
  }

  if (resolved.requiresAuth) {
    return (
      <DocsShell signedIn={signedIn}>
        <div className="mx-auto max-w-3xl rounded-[30px] border border-white/10 bg-[#121726]/88 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-white">Sign in to view internal documentation</h1>
          <p className="mt-4 text-base leading-8 text-white/60">
            This page is part of Mahita’s internal technical wiki. The public project overview is available without sign-in, but deeper architecture, evidence, and runbooks require an authenticated session.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/auth/signin" className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300">
              Sign in
            </Link>
            <Link href="/docs" className="rounded-2xl border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10">
              Back to docs
            </Link>
          </div>
        </div>
      </DocsShell>
    )
  }

  return (
    <DocsShell signedIn={signedIn}>
      <DocsArticle doc={resolved.doc} />
    </DocsShell>
  )
}
