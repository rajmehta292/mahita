import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import type { DocRecord, DocCategory } from "@/lib/docs"
import { getDocCategoryLabel, getDocHref, groupDocsByCategory } from "@/lib/docs"

const CATEGORY_ORDER: DocCategory[] = [
  "project-overview",
  "senior-project",
  "guidebook",
  "runbook",
  "evidence",
  "status",
  "archive",
]

const START_HERE_SLUGS = [
  "project-overview/how-to-use-this-documentation",
  "project-overview/executive-overview",
  "senior-project/report-draft",
  "senior-project/presentation-outline",
  "project-overview/current-state-and-limitations",
]

const PORTAL_GROUPS: Array<{
  title: string
  description: string
  categories: DocCategory[]
  lockedMessage?: string
}> = [
  {
    title: "Senior Project Overview",
    description: "Project framing, quarter-by-quarter evolution, current state, and future direction.",
    categories: ["project-overview"],
  },
  {
    title: "Report And Presentation",
    description: "Submission draft, speaking materials, demo flow, and reviewer-facing communication guidance.",
    categories: ["senior-project"],
  },
  {
    title: "Architecture And System Guide",
    description: "Guidebooks for authentication, architecture, testing, and the codebase structure.",
    categories: ["guidebook", "status"],
    lockedMessage: "Sign in to unlock the deeper technical guidebooks and current-state records.",
  },
  {
    title: "Setup And Demo Guides",
    description: "Bootstrap, presentation mode, operator recovery, and demo/lab setup instructions.",
    categories: ["runbook"],
    lockedMessage: "Sign in to unlock detailed runbooks for live-capable demo prep and operations.",
  },
  {
    title: "Evidence, Limitations, And Roadmap",
    description: "Development history, architecture decisions, known limitations, and recovery planning.",
    categories: ["evidence", "archive"],
    lockedMessage: "Sign in to unlock the full evidence log, bug archive, and internal recovery materials.",
  },
]

function statusClasses(status: DocRecord["status"]) {
  switch (status) {
    case "Current":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
    case "Transitional":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200"
    case "Superseded":
      return "border-red-400/25 bg-red-400/10 text-red-200"
    default:
      return "border-white/12 bg-white/8 text-white/60"
  }
}

export function DocsIndex({
  docs,
  signedIn,
}: {
  docs: DocRecord[]
  signedIn: boolean
}) {
  const grouped = groupDocsByCategory(docs)
  const docBySlug = new Map(docs.map((doc) => [doc.slug, doc]))
  const startHereDocs = START_HERE_SLUGS.map((slug) => docBySlug.get(slug)).filter(Boolean) as DocRecord[]

  return (
    <div className="space-y-10">
      <section className="rounded-[30px] border border-white/10 bg-[#121726]/85 p-8 shadow-2xl shadow-black/20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300/75">Project Record</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Mahita documentation, evidence, and senior project guidebook
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-white/58">
          This wiki is the live source of truth for Mahita’s senior project narrative, current platform status,
          architecture decisions, testing evidence, and operator runbooks. Public pages tell the project story;
          signed-in pages expose the deeper technical documentation.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/62">
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Two-quarter research arc</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Truthful status tracking</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Presentation-safe demo bundle</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">Faculty-reviewer narrative</span>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
            {signedIn ? "Internal guidebooks unlocked" : "Sign in to view internal runbooks"}
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[28px] border border-cyan-400/15 bg-[#101726]/88 p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300/75">Start Here</p>
          <h2 className="mt-4 text-3xl font-semibold text-white">Read these five pages in order</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/56">
            This sequence is optimized for a faculty reviewer or new engineer who needs to understand what Mahita is,
            what was actually built, what is still unfinished, and how to demo it safely.
          </p>

          <div className="mt-6 space-y-3">
            {startHereDocs.map((doc, index) => (
              <Link
                key={doc.slug}
                href={getDocHref(doc.slug)}
                className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-cyan-400/25 hover:bg-white/8"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-base font-medium text-white">{doc.title}</div>
                    <div className="mt-1 text-sm text-white/52">{doc.description}</div>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111624]/88 p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">Documentation Portal</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">What this portal contains</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-white/58">
            <p>Public pages tell the senior-project story and can be shared directly with reviewers.</p>
            <p>Signed-in pages hold the deeper architecture guidebooks, evidence logs, and operational runbooks.</p>
            <p>Status badges distinguish current truth, transitional architecture, historical context, and future-work planning.</p>
            <p>The demo bundle, evidence export, and presentation runbooks are designed to keep the project presentable even when live systems are fragile.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Documentation groups</h2>
          <p className="mt-2 text-sm text-white/45">
            The portal is intentionally split into five review-friendly sections so faculty can move from story to system to evidence without guessing where to start.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {PORTAL_GROUPS.map((group) => {
            const groupEntries = group.categories.flatMap((category) => grouped.get(category) ?? [])

            return (
              <div key={group.title} className="rounded-[24px] border border-white/10 bg-[#111624]/88 p-6">
                <h3 className="text-xl font-semibold text-white">{group.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/52">{group.description}</p>

                {groupEntries.length ? (
                  <div className="mt-5 space-y-3">
                    {groupEntries.slice(0, 4).map((doc) => (
                      <Link
                        key={doc.slug}
                        href={getDocHref(doc.slug)}
                        className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-cyan-400/25 hover:bg-white/8"
                      >
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                          <span className={`rounded-full border px-2 py-0.5 ${statusClasses(doc.status)}`}>{doc.status}</span>
                          {doc.visibility === "signed-in" ? (
                            <span className="inline-flex items-center gap-1 text-white/45">
                              <Lock className="h-3 w-3" />
                              Signed-in
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-base font-medium text-white">{doc.title}</div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/52">
                    {group.lockedMessage || "No current entries are visible in this section."}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {CATEGORY_ORDER.map((category) => {
        const entries = grouped.get(category)
        if (!entries?.length) {
          return null
        }

        return (
          <section key={category} className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">{getDocCategoryLabel(category)}</h2>
                <p className="mt-1 text-sm text-white/45">
                  {category === "archive"
                    ? "Older documents preserved for context. Treat these as historical unless a page is explicitly marked current."
                    : "Current project materials surfaced for review, presentation, and future updates."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {entries.map((doc) => (
                <Link
                  key={doc.slug}
                  href={getDocHref(doc.slug)}
                  className="group rounded-[24px] border border-white/10 bg-[#111624]/88 p-6 transition hover:border-cyan-400/25 hover:bg-[#151b2b]"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em]">
                    <span className={`rounded-full border px-2.5 py-1 ${statusClasses(doc.status)}`}>{doc.status}</span>
                    <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-white/52">
                      {doc.audience}
                    </span>
                    {doc.visibility === "signed-in" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-white/52">
                        <Lock className="h-3 w-3" />
                        Signed-in
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white transition group-hover:text-cyan-200">
                    {doc.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/55">{doc.description}</p>
                  <div className="mt-5 text-xs uppercase tracking-[0.18em] text-white/35">
                    Updated {doc.updatedAt}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
