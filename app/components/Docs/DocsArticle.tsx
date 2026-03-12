import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"
import { Lock, ArrowLeft } from "lucide-react"
import type { DocRecord } from "@/lib/docs"

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

export function DocsArticle({ doc }: { doc: DocRecord }) {
  return (
    <article className="space-y-6">
      <Link
        href="/docs"
        className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documentation
      </Link>

      <header className="rounded-[28px] border border-white/10 bg-[#121726]/88 p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em]">
          <span className={`rounded-full border px-2.5 py-1 ${statusClasses(doc.status)}`}>{doc.status}</span>
          <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-white/55">
            {doc.audience}
          </span>
          {doc.visibility === "signed-in" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-white/55">
              <Lock className="h-3 w-3" />
              Signed-in
            </span>
          ) : null}
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">{doc.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-white/58">{doc.description}</p>
        <div className="mt-5 text-xs uppercase tracking-[0.18em] text-white/35">
          Updated {doc.updatedAt} · Source {doc.relativePath}
        </div>
        {doc.status === "Historical" || doc.status === "Superseded" ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100/85">
            This document is preserved for historical context. Treat it as background unless a newer current-state or guidebook page says otherwise.
          </div>
        ) : null}
      </header>

      <div className="rounded-[28px] border border-white/10 bg-[#0f1420]/92 p-8">
        <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-li:text-white/75 prose-strong:text-white prose-a:text-cyan-300 prose-code:text-cyan-200 prose-code:bg-white/6 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:border prose-pre:border-white/10 prose-pre:bg-[#0a0f18] prose-blockquote:border-cyan-400/40 prose-blockquote:text-white/70">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
        </div>
      </div>
    </article>
  )
}
