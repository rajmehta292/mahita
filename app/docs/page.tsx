import { DocsIndex } from "@/app/components/Docs/DocsIndex"
import { DocsShell } from "@/app/components/Docs/DocsShell"
import { getVisibleDocs } from "@/lib/docs"
import { getAppServerSession } from "@/lib/server-session"

export default async function DocumentationHomePage() {
  const session = await getAppServerSession()
  const signedIn = Boolean(session?.user?.id)
  const docs = await getVisibleDocs(signedIn)

  return (
    <DocsShell signedIn={signedIn}>
      <DocsIndex docs={docs} signedIn={signedIn} />
    </DocsShell>
  )
}
