---
title: Senior Project Report Draft
slug: senior-project/report-draft
category: senior-project
visibility: public
audience: reviewers
status: Current
order: 1
updatedAt: 2026-03-11
---

# Senior Project report draft

This draft is structured to match a rigorous engineering-report format while staying honest about Mahita’s software scope. It is not written as marketing copy. It is written as a technical record of what problem was explored, how the project evolved, what architecture was ultimately built, and which parts remain unfinished.

## 1. Introduction and problem framing

Mahita addresses the gap between retail-accessible research tools and brokerage-connected execution tools. Most available systems emphasize either charting and backtesting or broker-native account access. They often do not preserve strategy context, user context, and future automation context inside one coherent platform. As a result, the transition from idea formation to trustworthy execution is fragmented. Mahita was designed to explore a more unified workflow.

The problem is not simply “how to place trades from a browser.” The actual problem is how to create a platform where identity, account context, strategy context, and operator trust boundaries are connected strongly enough that future live testing can be added responsibly. That is why this project ultimately became more architectural than originally expected.

## 2. Background and comparable systems

Mahita should be compared against at least three classes of systems: charting and alerting tools such as TradingView, broker-native retail terminals, and institutional research or execution platforms. The argument is not that Mahita matches these systems in maturity, polish, or scale. The argument is that Mahita explores how a smaller research platform could unify the workflow across brokerage onboarding, account context, strategy experimentation, and future live-testing pathways.

This is also why a modular full-stack web application was a better direction than the initial Raspberry Pi and central-controller idea. The broker/API/auth/data problems had to be solved before distributed execution hardware made sense. The project therefore shifted from “many remote agents” to “one coherent system with trustworthy platform boundaries.”

## 3. Quarter 1 research evolution

Quarter 1 was the exploratory phase. It should be documented honestly as the period when the problem was still being defined:

- Finviz-based local demo
- early ML interest without a mature model of how to use it
- Raspberry Pi + central control concept
- lessons from overreaching before the core platform was defined

The most important outcome of Quarter 1 was not a finished product. It was a clearer understanding that the original plan mixed too many abstractions too early. The project initially leaned toward adding distributed execution concepts and machine-learning ideas before the platform could even reliably represent a user, a strategy, a brokerage connection, and a live account context. Quarter 1 therefore served as the research phase that exposed the need to narrow the system to its foundations.

## 4. Quarter 2 system architecture and implementation

Quarter 2 is where Mahita became a real system instead of a concept. The final implementation direction focused on the actual platform that was built:

- NextAuth + Google identity
- Schwab developer-key onboarding and Schwab OAuth brokerage authorization
- role-aware server-side routing
- user preference persistence
- dashboard, portfolio, history, active trader, and backtester surfaces
- documentation, operator tooling, and current control-plane work

The architecture that emerged is layered. Mahita identity is separate from Schwab brokerage authorization. Session state and roles are separate from provider-pool and admin operations. User-facing portfolio and trader flows are separate from operator tooling and transitional platform data access. This separation is important because a trading platform that mixes those responsibilities casually becomes difficult to trust and difficult to maintain.

## 5. Authentication, Schwab integration, and trust boundaries

This section should be one of the strongest parts of the report. It should clearly explain:

- the difference between Mahita identity and Schwab account authorization
- why the Google callback and Schwab callback are separate
- how user isolation works
- how operator/admin access differs from user access
- why provider credentials and user brokerage credentials must be separated

Mahita now has a hybrid but far clearer trust model than earlier project versions. Google OAuth identifies the Mahita user. Schwab OAuth authorizes that user’s brokerage access. These are deliberately different systems because authenticating into Mahita is not the same as authorizing brokerage activity. The current architecture also distinguishes between customer brokerage credentials and platform/provider access, even though the provider plane still includes a documented transitional bridge. That distinction should be emphasized in the final report because it represents one of the project’s strongest engineering lessons.

## 6. Backtesting/live-testing workflow and current prototype limits

This section should describe both the product goal and the current reality:

- the intended path is strategy research -> validation -> live monitoring -> eventual live testing
- the current backtesting engine is still a prototype
- the UI and engine are useful enough to demonstrate the concept, but not yet final enough to claim parity with mature commercial tools

This should be described as a prototype that successfully demonstrates workflow intent, not as a completed research engine. The current platform can show the user-facing flow and the system boundaries needed for future strategy promotion, but the data quality, strategy runtime, and deployment semantics are not mature enough to support a strong production claim.

## 7. UI/UX and operator tooling

Explain why the terminal interface matters:

- account-aware flows
- unified navigation
- operator tooling for data and control-plane visibility
- the importance of documentation and runbooks in a system that touches financial data

For a project like Mahita, documentation and runbooks are not secondary deliverables. They are part of the system. Once brokerage onboarding, admin controls, backtesting, and future automation all exist in the same application, the platform becomes difficult to evaluate without a clear project record. The documentation system therefore became part of the project’s engineering output, not merely a written afterthought.

## 8. Challenges, bugs, and unfinished work

This section should not be defensive. It should be analytical.

It should cover:

- data availability and correctness limits for backtesting
- auth/origin/callback complexity
- brokerage and provider credential separation
- UI stabilization work
- architectural tasks that were identified but not completed in time

The strongest version of this section treats unfinished work as evidence of system understanding. The project encountered real complexity around OAuth flows, multi-user session behavior, public versus local auth origins, provider-credential separation, and the difference between a “strategy editor” and a truly trustworthy strategy runtime. Those are not excuses; they are the constraints that shaped the final architecture.

## 9. Future work: data quality, ML strategy lab, strategy automation

Future work should be specific:

- better historical data and coverage
- a structured ML strategy-lab workflow
- a real strategy deployment model
- improved account analytics and monitoring

The ML direction should be framed as a real research continuation of the two-quarter project, not as a disconnected add-on. The earlier vague interest in machine learning matured into a more disciplined idea: use a strategy-lab workflow to run candidate strategies through multiple model and analysis pipelines, summarize results, and iteratively refine what constitutes a more robust strategy under changing market conditions. That direction now makes sense because the project has a clearer idea of where strategy research would live in the platform.

## 10. Conclusion and engineering lessons

The conclusion should emphasize:

- how the project matured from broad ideas into a more disciplined system
- what was learned about authentication, security, APIs, and product architecture
- why defining trust boundaries and system constraints is itself a valuable engineering outcome

Mahita should therefore be presented as a functional and defensible foundation. It is not complete. However, it now reflects stronger engineering judgment than the original concept because the current platform is grounded in real trust boundaries, real integration constraints, and a clearer system roadmap. That is a valid and meaningful outcome for a senior project in software engineering.
