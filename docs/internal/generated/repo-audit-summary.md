# Repo audit summary

Generated: 2026-03-18T02:32:15.856Z

## Lane status
- PASS `typecheck` via `npm run verify:repo:typecheck`
- PASS `lint-source` via `npm run verify:repo:lint:source`
- PASS `lint-noise` via `npm run verify:repo:lint:noise`
- PASS `repo-hygiene` via `npm run verify:repo:repo-hygiene`
- PASS `docs-portability` via `npm run verify:repo:docs-portability`
- FAIL `unit` via `npm run verify:repo:unit`
- FAIL `e2e` via `npm run verify:repo:e2e`
- PASS `visual` via `npm run verify:repo:visual`
- PASS `build` via `npm run verify:repo:build`
- MANUAL `live-smoke` - Manual runbook required on the Windows operator machine with secrets.

## Blocking findings
- P1 `unit`

```text
Not implemented: navigation to another Document
Not implemented: navigation to another Document
[90mstderr[2m | tests/settings-page.dom.test.tsx[2m > [22m[2mSettingsPage[2m > [22m[2mshows a typed runtime hint when saving credentials fails with a schema mismatch
[22m[39mSave error: AppError: Mahita detected a Prisma schema/client mismatch.
    at parseResponseError (C:/mahita/mahita/lib/app-errors.ts:226:10)
    at handleSave (C:/mahita/mahita/app/settings/page.tsx:108:23) {
  code: [32m'RUNTIME_SCHEMA_MISMATCH'[39m,
  status: [33m503[39m,
  details: { missingModels: [ [32m'brokerageConnection'[39m ] },
  hint: [32m'Run `npx prisma generate` and restart the dev server.'[39m,
  recoverable: [33mtrue[39m
}

Not implemented: navigation to another Document
[90mstderr[2m | tests/server-session.unit.test.ts[2m > [22m[2mserver-session[2m > [22m[2mreturns null when NextAuth throws a recoverable stale-session error
[22m[39m[auth] Recoverable session error while reading NextAuth session; treating request as signed out. {
  name: [32m'Error'[39m,
  message: [32m'[next-auth][error][JWT_SESSION_ERROR] "decryption operation failed"'[39m
}

Not implemented: navigation to another Document

[31m⎯⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 2 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m tests/admin-control-plane.dom.test.tsx[2m > [22mAdminControlPlane[2m > [22mdoes not crash when a provider member is missing credential metadata
[31m[1mTestingLibraryElementError[22m[39m: Unable to find an element with the text: /unknown · unknown · priority 10/i. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Ignored nodes: comments, script, style
[36m<body>[39m
  [36m<div>[39m
    [36m<div[39m
      [33mclass[39m=[32m"flex-1 bg-[#0d0e12] text-white overflow-y-auto"[39m
    [36m>[39m
      [36m<div[39m
        [33mclass[39m=[32m"max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6"[39m
      [36m>[39m
        [36m<div[39m
          [33mclass[39m=[32m"flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"[39m
        [36m>[39m
          [36m<div>[39m
            [36m<p[39m
              [33mclass[39m=[32m"text-[11px] uppercase tracking-[0.3em] text-white/35"[39m
            [36m>[39m
              [0mSuperuser Control Plane[0m
            [36m</p>[39m
            [36m<h1[39m
              [33mclass[39m=[32m"text-3xl font-semibold tracking-tight"[39m
            [36m>[39m
              [0mAdmin Control[0m
            [36m</h1>[39m
            [36m<p[39m
              [33mclass[39m=[32m"text-sm text-white/45 mt-2"[39m
            [36m>[39m
              [0mDI-UI is the primary operator surface. Recovery actions, provider oversight, and audited administration stay here with it.[0m
            [36m</p>[39m
          [36m</div>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-refresh-cw w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<path[39m
                [33md[39m=[32m"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M21 3v5h-5"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M8 16H3v5"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mRefresh[0m
          [36m</button>[39m
        [36m</div>[39m
        [36m<div[39m
          [33mclass[39m=[32m"flex flex-wrap gap-2"[39m
        [36m>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-shield w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<path[39m
                [33md[39m=[32m"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mOverview[0m
          [36m</button>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors bg-primary/15 border-primary/30 text-primary"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-database w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<ellipse[39m
                [33mcx[39m=[32m"12"[39m
                [33mcy[39m=[32m"5"[39m
                [33mrx[39m=[32m"9"[39m
                [33mry[39m=[32m"3"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M3 5V19A9 3 0 0 0 21 19V5"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M3 12A9 3 0 0 0 21 12"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mProvider Pool[0m
          [36m</button>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-layers w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<path[39m
                [33md[39m=[32m"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mDI-UI[0m
          [36m</button>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-wrench w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<path[39m
                [33md[39m=[32m"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mRecovery[0m
          [36m</button>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-users w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<path[39m
                [33md[39m=[32m"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M16 3.128a4 4 0 0 1 0 7.744"[39m
              [36m/>[39m
              [36m<path[39m
                [33md[39m=[32m"M22 21v-2a4 4 0 0 0-3-3.87"[39m
              [36m/>[39m
              [36m<circle[39m
                [33mcx[39m=[32m"9"[39m
                [33mcy[39m=[32m"7"[39m
                [33mr[39m=[32m"4"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mUsers[0m
          [36m</button>[39m
          [36m<button[39m
            [33mclass[39m=[32m"inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"[39m
          [36m>[39m
            [36m<svg[39m
              [33maria-hidden[39m=[32m"true"[39m
              [33mclass[39m=[32m"lucide lucide-activity w-4 h-4"[39m
              [33mfill[39m=[32m"none"[39m
              [33mheight[39m=[32m"24"[39m
              [33mstroke[39m=[32m"currentColor"[39m
              [33mstroke-linecap[39m=[32m"round"[39m
              [33mstroke-linejoin[39m=[32m"round"[39m
              [33mstroke-width[39m=[32m"2"[39m
              [33mviewBox[39m=[32m"0 0 24 24"[39m
              [33mwidth[39m=[32m"24"[39m
              [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
            [36m>[39m
              [36m<path[39m
                [33md[39m=[32m"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"[39m
              [36m/>[39m
            [36m</svg>[39m
            [0mAudit Log[0m
          [36m</button>[39m
        [36m</div>[39m
        [36m<div[39m
          [33mclass[39m=[32m"grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6"[39m
        [36m>[39m
          [36m<div[39m
            [33mclass[39m=[32m"rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4"[39m
          [36m>[39m
            [36m<div>[39m
              [36m<h2[39m
                [33mclass[39m=[32m"text-lg font-semibold"[39m
              [36m>[39m
                [0mPromote Provider[0m
              [36m</h2>[39m
              [36m<p[39m
                [33mclass[39m=[32m"text-sm text-white/45 mt-1"[39m
              [36m>[39m
                [0mUntil dedicated platform credentials exist, explicitly promote one connected superuser Schwab bridge into the market-data provider pool.[0m
              [36m</p>[39m
            [36m</div>[39m
            [36m<select[39m
              [33mclass[39m=[32m"w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"[39m
            [36m>[39m
              [36m<option[39m
                [33mvalue[39m=[32m""[39m
              [36m>[39m
                [0mNo connected brokerage users[0m
              [36m</option>[39m
            [36m</select>[39m
            [36m<button[39m
              [33mclass[39m=[32m"rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-black disabled:opacity-50"[39m
              [33mdisabled[39m=[32m""[39m
            [36m>[39m
              [0mUse selected user for market-data pool[0m
            [36m</button>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden"[39m
          [36m>[39m
            [36m<div[39m
              [33mclass[39m=[32m"px-5 py-4 border-b border-white/10"[39m
            [36m>[39m
              [36m<h2[39m
                [33mclass[39m=[32m"text-lg font-semibold"[39m
              [36m>[39m
                [0mProvider Pool Members[0m
              [36m</h2>[39m
            [36m</div>[39m
            [36m<div[39m
              [33mclass[39m=[32m"divide-y divide-white/5"[39m
            [36m>[39m
              [36m<div[39m
                [33mclass[39m=[32m"px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"[39m
              [36m>[39m
                [36m<div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"flex items-center gap-2"[39m
                  [36m>[39m
                    [36m<span[39m
                      [33mclass[39m=[32m"text-base font-medium"[39m
                    [36m>[39m
                      [0mFallback member[0m
                    [36m</span>[39m
                    [36m<span[39m
                      [33mclass[39m=[32m"text-[10px] uppercase tracking-[0.2em] text-primary"[39m
                    [36m>[39m
                      [0mPrimary[0m
                    [36m</span>[39m
                    [36m<span[39m
                      [33mclass[39m=[32m"text-[10px] uppercase tracking-[0.2em] text-white/35"[39m
                    [36m>[39m
                      [0mACTIVE[0m
                    [36m</span>[39m
                  [36m</div>[39m
                  [36m<p[39m
                    [33mclass[39m=[32m"text-sm text-white/45 mt-1"[39m
                  [36m>[39m
                    [0munknown[0m
                    [0m  /  [0m
                    [0munknown[0m
                    [0m  /  priority [0m
                    [0m10[0m
                  [36m</p>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"flex flex-wrap gap-2"[39m
                [36m>[39m
                  [36m<button[39m
                    [33mclass[39m=[32m"rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"[39m
                  [36m>[39m
                    [0mMake primary[0m
                  [36m</button>[39m
                  [36m<button[39m
                    [33mclass[39m=[32m"rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"[39m
                  [36m>[39m
                    [0mDisable[0m
                  [36m</button>[39m
                  [36m<button[39m
                    [33mclass[39m=[32m"rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/20"[39m
                  [36m>[39m
                    [0mReveal[0m
                  [36m</button>[39m
                [36m</div>[39m
              [36m</div>[39m
            [36m</div>[39m
          [36m</div>[39m
        [36m</div>[39m
      [36m</div>[39m
    [36m</div>[39m
  [36m</div>[39m
[36m</body>[39m
[90m [2m❯[22m Object.getElementError node_modules/@testing-library/dom/dist/config.js:[2m37:19[22m[39m
[90m [2m❯[22m node_modules/@testing-library/dom/dist/query-helpers.js:[2m76:38[22m[39m
[90m [2m❯[22m node_modules/@testing-library/dom/dist/query-helpers.js:[2m52:17[22m[39m
[90m [2m❯[22m node_modules/@testing-library/dom/dist/query-helpers.js:[2m95:19[22m[39m
[36m [2m❯[22m tests/admin-control-plane.dom.test.tsx:[2m322:23[22m[39m
    [90m320| [39m
    [90m321| [39m        await waitFor(() => expect(screen.getByText('Fallback member')…
    [90m322| [39m        expect(screen.getByText(/unknown · unknown · priority 10/i)).t…
    [90m   | [39m                      [31m^[39m
    [90m323| [39m    })
    [90m324| [39m})

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯[22m[39m

[41m[1m FAIL [22m[49m tests/dashboard-summary.dom.test.tsx[2m > [22mDashboardPage[2m > [22mupdates summary cards when the selected account changes
[31m[1mTestingLibraryElementError[22m[39m: Found multiple elements with the text: Brokerage • 9998

Here are the matching elements:

Ignored nodes: comments, script, style
[36m<div[39m
  [33mclass[39m=[32m"text-[10px] text-gray-500 font-bold uppercase tracking-tight"[39m
[36m>[39m
  [0mBrokerage • 9998[0m
[36m</div>[39m

Ignored nodes: comments, script, style
[36m<div[39m
  [33mclass[39m=[32m"text-white font-semibold"[39m
[36m>[39m
  [0mBrokerage • 9998[0m
[36m</div>[39m

(If this is intentional, then use the `*AllBy*` variant of the query (like `queryAllByText`, `getAllByText`, or `findAllByText`)).

Ignored nodes: comments, script, style
[36m<body>[39m
  [36m<div>[39m
    [36m<div>[39m
      [36m<div>[39m
        [36m<div[39m
          [33mclass[39m=[32m"flex-1 flex flex-col bg-[#131722] overflow-hidden"[39m
        [36m>[39m
          [36m<div[39m
            [33mclass[39m=[32m"h-20 bg-[#1E222D]/80 backdrop-blur-md border-b border-[#2A2E39] flex items-center justify-between px-8 shrink-0 z-30"[39m
          [36m>[39m
            [36m<div[39m
              [33mclass[39m=[32m"flex items-center gap-6"[39m
            [36m>[39m
              [36m<div[39m
                [33mclass[39m=[32m"flex items-center gap-3"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"[39m
                [36m>[39m
                  [36m<svg[39m
                    [33maria-hidden[39m=[32m"true"[39m
                    [33mclass[39m=[32m"lucide lucide-chart-column w-5 h-5 text-white"[39m
                    [33mfill[39m=[32m"none"[39m
                    [33mheight[39m=[32m"24"[39m
                    [33mstroke[39m=[32m"currentColor"[39m
                    [33mstroke-linecap[39m=[32m"round"[39m
                    [33mstroke-linejoin[39m=[32m"round"[39m
                    [33mstroke-width[39m=[32m"2"[39m
                    [33mviewBox[39m=[32m"0 0 24 24"[39m
                    [33mwidth[39m=[32m"24"[39m
                    [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
                  [36m>[39m
                    [36m<path[39m
                      [33md[39m=[32m"M3 3v16a2 2 0 0 0 2 2h16"[39m
                    [36m/>[39m
                    [36m<path[39m
                      [33md[39m=[32m"M18 17V9"[39m
                    [36m/>[39m
                    [36m<path[39m
                      [33md[39m=[32m"M13 17V5"[39m
                    [36m/>[39m
                    [36m<path[39m
                      [33md[39m=[32m"M8 17v-3"[39m
                    [36m/>[39m
                  [36m</svg>[39m
                [36m</div>[39m
                [36m<h1[39m
                  [33mclass[39m=[32m"text-white font-black text-xl tracking-tight hidden sm:block"[39m
                [36m>[39m
                  [0mDashboard[0m
                [36m</h1>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"h-8 w-px bg-[#2A2E39] mx-2 hidden sm:block"[39m
              [36m/>[39m
              [36m<div[39m
                [33mclass[39m=[32m"relative group"[39m
              [36m>[39m
                [36m<select[39m
                  [33mclass[39m=[32m"bg-[#131722] text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-[#2A2E39] focus:outline-none focus:border-blue-500 appearance-none pr-10 hover:border-blue-500/50 transition-all cursor-pointer shadow-inner"[39m
                [36m>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"hash-998"[39m
                  [36m>[39m
                    [0m...[0m
                    [0m9998[0m
                    [0m ([0m
                    [0mBrokerage[0m
                    [0m)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"hash-251"[39m
                  [36m>[39m
                    [0m...[0m
                    [0m0251[0m
                    [0m ([0m
                    [0mIRA[0m
                    [0m)[0m
                  [36m</option>[39m
                [36m</select>[39m
                [36m<svg[39m
                  [33maria-hidden[39m=[32m"true"[39m
                  [33mclass[39m=[32m"lucide lucide-chevron-down absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors"[39m
                  [33mfill[39m=[32m"none"[39m
                  [33mheight[39m=[32m"24"[39m
                  [33mstroke[39m=[32m"currentColor"[39m
                  [33mstroke-linecap[39m=[32m"round"[39m
                  [33mstroke-linejoin[39m=[32m"round"[39m
                  [33mstroke-width[39m=[32m"2"[39m
                  [33mviewBox[39m=[32m"0 0 24 24"[39m
                  [33mwidth[39m=[32m"24"[39m
                  [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
                [36m>[39m
                  [36m<path[39m
                    [33md[39m=[32m"m6 9 6 6 6-6"[39m
                  [36m/>[39m
                [36m</svg>[39m
              [36m</div>[39m
            [36m</div>[39m
            [36m<div[39m
              [33mclass[39m=[32m"flex items-center gap-4 text-gray-500"[39m
            [36m>[39m
              [36m<svg[39m
                [33maria-hidden[39m=[32m"true"[39m
                [33mclass[39m=[32m"lucide lucide-clock w-4 h-4"[39m
                [33mfill[39m=[32m"none"[39m
                [33mheight[39m=[32m"24"[39m
                [33mstroke[39m=[32m"currentColor"[39m
                [33mstroke-linecap[39m=[32m"round"[39m
                [33mstroke-linejoin[39m=[32m"round"[39m
                [33mstroke-width[39m=[32m"2"[39m
                [33mviewBox[39m=[32m"0 0 24 24"[39m
                [33mwidth[39m=[32m"24"[39m
                [33mxmlns[39m=[32m"http://www.w3.org/2000/svg"[39m
              [36m>[39m
                [36m<circle[39m
                  [33mcx[39m=[32m"12"[39m
                  [33mcy[39m=[32m"12"[39m
                  [33mr[39m=[32m"10"[39m
                [36m/>[39m
                [36m<path[39m
                  [33md[39m=[32m"M12 6v6l4 2"[39m
                [36m/>[39m
              [36m</svg>[39m
              [36m<span[39m
                [33mclass[39m=[32m"text-[10px] font-black uppercase tracking-widest"[39m
              [36m>[39m
                [0m07:32 PM[0m
              [36m</span>[39m
            [36m</div>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"flex-1 overflow-auto p-8 bg-gradient-to-b from-[#131722] to-[#0D0F14]"[39m
          [36m>[39m
            [36m<div[39m
              [33mclass[39m=[32m"max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700"[39m
            [36m>[39m
              [36m<div[39m
                [33mclass[39m=[32m"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 hover:border-blue-500/30 transition-all shadow-xl group cursor-pointer"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"flex justify-between items-center mb-4"[3...
[90m [2m❯[22m Object.getElementError node_modules/@testing-library/dom/dist/config.js:[2m37:19[22m[39m
[90m [2m❯[22m getElementError node_modules/@testing-library/dom/dist/query-helpers.js:[2m20:35[22m[39m
[90m [2m❯[22m getMultipleElementsFoundError node_modules/@testing-library/dom/dist/query-helpers.js:[2m23:10[22m[39m
[90m [2m❯[22m node_modules/@testing-library/dom/dist/query-helpers.js:[2m55:13[22m[39m
[90m [2m❯[22m node_modules/@testing-library/dom/dist/query-helpers.js:[2m95:19[22m[39m
[36m [2m❯[22m tests/dashboard-summary.dom.test.tsx:[2m144:23[22m[39m
    [90m142| [39m        })
    [90m143| [39m        await waitFor(() => expect(screen.getAllByText('$0.99').length…
    [90m144| [39m        expect(screen.getByText('Brokerage • 9998')).toBeInTheDocument…
    [90m   | [39m                      [31m^[39m
    [90m145| [39m
    [90m146| [39m        fireEvent[33m.[39m[34mchange[39m(screen[33m.[39m[34mgetByRole[39m([32m'combobox'[39m)[33m,[39m {

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m
```

- P1 `e2e`

```text
[2m[WebServer] [22m[2mEnvironment variables loaded from .env[22m
[2m[WebServer] [22mTurbopack build encountered 2 warnings:
[2m[WebServer] [22m./lib/server-paths.ts:4:18
[2m[WebServer] [22mThe file pattern '/ROOT/' matches 12195 files in [project]/
[2m[WebServer] [22m[0m [90m 2 |[39m [36mimport[39m path [36mfrom[39m [32m'node:path'[39m
[2m[WebServer] [22m [90m 3 |[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 4 |[39m [36mconst[39m repoRoot [33m=[39m path[33m.[39mresolve(process[33m.[39mcwd())
[2m[WebServer] [22m [90m   |[39m                  [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m [90m 5 |[39m [36mconst[39m dataRoot [33m=[39m path[33m.[39mjoin(repoRoot[33m,[39m [32m'data'[39m)
[2m[WebServer] [22m [90m 6 |[39m [36mconst[39m vaultsRoot [33m=[39m path[33m.[39mjoin(dataRoot[33m,[39m [32m'vaults'[39m)
[2m[WebServer] [22m [90m 7 |[39m [36mconst[39m lakeRoot [33m=[39m path[33m.[39mjoin(dataRoot[33m,[39m [32m'lake'[39m)[0m
[2m[WebServer] [22m
[2m[WebServer] [22mOverly broad patterns can lead to build performance issues and over bundling.
[2m[WebServer] [22m
[2m[WebServer] [22mImport trace:
[2m[WebServer] [22m  App Route:
[2m[WebServer] [22m    ./lib/server-paths.ts
[2m[WebServer] [22m    ./app/services/market-data/vault-manager.ts
[2m[WebServer] [22m    ./app/api/admin/data-command/action/route.ts
[2m[WebServer] [22m
[2m[WebServer] [22m
[2m[WebServer] [22m./app/services/market-data/parquet-store.ts:58:16
[2m[WebServer] [22mThe file pattern ('/ROOT/data/lake/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/bars.parquet' | '/ROOT/data/lake' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/bars.parquet' | '/ROOT/data/lake/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/bars.parquet' | '/ROOT/data/lake' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/bars.parquet' | '/ROOT/data/lake/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> 'bars.parquet' | '/ROOT/data/lake' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> 'bars.parquet' | '/ROOT/data/lake/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> 'bars.parquet' | '/ROOT/data/lake' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> '/' <dynamic> 'bars.parquet') matches 80320 files in [project]/
[2m[WebServer] [22m[0m [90m 56 |[39m         [36mconst[39m partitionPath [33m=[39m [32m`${year}/${month}/${day}`[39m
[2m[WebServer] [22m [90m 57 |[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 58 |[39m         [36mreturn[39m path[33m.[39mjoin(
[2m[WebServer] [22m [90m    |[39m                [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 59 |[39m             [33mLAKE_ROOT[39m[33m,[39m
[2m[WebServer] [22m [90m    |[39m [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 60 |[39m             instrumentPath[33m,[39m
[2m[WebServer] [22m [90m    |[39m [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 61 |[39m             partitionPath[33m,[39m
[2m[WebServer] [22m [90m    |[39m [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 62 |[39m             [32m'bars.parquet'[39m
[2m[WebServer] [22m [90m    |[39m [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m[31m[1m>[22m[39m[90m 63 |[39m         )
[2m[WebServer] [22m [90m    |[39m [31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m[31m[1m^[22m[39m
[2m[WebServer] [22m [90m 64 |[39m     }
[2m[WebServer] [22m [90m 65 |[39m
[2m[WebServer] [22m [90m 66 |[39m     [90m/**[39m[0m
[2m[WebServer] [22m
[2m[WebServer] [22mOverly broad patterns can lead to build performance issues and over bundling.
[2m[WebServer] [22m
[2m[WebServer] [22mImport traces:
[2m[WebServer] [22m  #1 [App Route]:
[2m[WebServer] [22m    ./app/services/market-data/parquet-store.ts
[2m[WebServer] [22m    ./app/api/v2/market-data/route.ts
[2m[WebServer] [22m
[2m[WebServer] [22m  #2 [App Route]:
[2m[WebServer] [22m    ./app/services/market-data/parquet-store.ts
[2m[WebServer] [22m    ./lib/server-paths.ts
[2m[WebServer] [22m    ./app/services/market-data/vault-manager.ts
[2m[WebServer] [22m    ./app/api/admin/data-command/action/route.ts
[2m[WebServer] [22m
[2m[WebServer] [22m
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[31m[1m⨯[22m[39m Error: aborted
[2m[WebServer] [22m    at [3mignore-listed frames[23m {
[2m[WebServer] [22m  code: [32m'ECONNRESET'[39m
[2m[WebServer] [22m}
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for MSFT: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
[2m[WebServer] [22m[SchwabProvider] Error fetching data for AAPL: Unsupported state or unable to authenticate data
```

