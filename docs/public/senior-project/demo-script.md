---
title: Demo Script
slug: senior-project/demo-script
category: senior-project
visibility: public
audience: presenter
status: Current
order: 3
updatedAt: 2026-03-11
---

# Demo script

Use this sequence to keep the presentation controlled and fast.

## Demo mode choice

Primary plan:

- live-capable dev box

Fallback plan:

- demo-safe local walkthrough with seeded data

If there is any sign of live auth or callback instability before the presentation starts, use the fallback without hesitation.

## 1. Open the documentation home (45–60 seconds)

Why:

- it immediately shows that the project is documented
- it frames the story before jumping into UI details

Say:

“Before I demo the app, I want to show that I treated this as an engineering system, not just a UI.”

Fallback if the app is unstable:

- stay in `/docs`
- continue the presentation through the overview, report, and current-state pages

## 2. Show the executive overview (30–45 seconds)

Say:

“Mahita is meant to connect strategy research, brokerage context, and future live testing in one platform.”

## 3. Show the dashboard (60–90 seconds)

Highlight:

- account-aware data
- multi-user context
- navigation and terminal layout

Say:

“Even in its current state, the platform keeps user and account context attached to the main research and trading surfaces.”

## 4. Show settings and Schwab setup (60–90 seconds)

Highlight:

- developer keys vs brokerage login
- security separation
- user-owned brokerage connection model

Do not try to walk through a live reconnect if the environment looks fragile.

## 5. Show the backtester (60–90 seconds)

Be explicit:

“This is a prototype engine and workspace. The concept and flow are here, but this is also one of the main areas that still needs refinement.”

If Monaco or runtime state looks degraded:

- call it out calmly
- point to the documentation that already classifies it as prototype
- move on

## 6. Show admin/documentation (45–60 seconds)

If time allows:

- open the control plane
- show that security, auditability, and operator tooling were considered

If admin or live data is unstable:

- show the documentation/wiki instead
- use the current-state and architecture pages to explain the same point

## 7. Close on future work (45–60 seconds)

Use the ML roadmap and strategy-lab framing to show that the unfinished work already has a concrete next direction.

## Recovery phrasing

If the live demo fails, say:

“Because this project touches real auth and external brokerage infrastructure, I prepared a documentation-backed fallback path. I’m going to continue with the same system explanation using the seeded demo flow and the architecture materials.”
