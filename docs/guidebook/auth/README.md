# Mahita Auth Guidebook

Status: Canonical guidebook for Mahita authentication, authorization, brokerage OAuth, and operator access. This guide complements the release-status documents in [docs/current_state_baseline.md](/Users/rmehta01/Sites/mahita/docs/current_state_baseline.md) and [docs/execution/mahita_recovery_program.md](/Users/rmehta01/Sites/mahita/docs/execution/mahita_recovery_program.md).

Read in order:

1. [00 - Overview](./00-overview.md)
2. [01 - Origin And Environment Matrix](./01-origin-and-environment-matrix.md)
3. [02 - NextAuth Lifecycle](./02-nextauth-lifecycle.md)
4. [03 - Role And Access Model](./03-role-and-access-model.md)
5. [04 - User Navigation State](./04-user-navigation-state.md)
6. [05 - Schwab OAuth And Brokerage Connections](./05-schwab-oauth-and-brokerage-connections.md)
7. [06 - Provider Pool And Platform Bridge](./06-provider-pool-and-platform-bridge.md)
8. [07 - Admin Break-Glass And Audit](./07-admin-break-glass-and-audit.md)
9. [08 - Code Map](./08-code-map.md)
10. [09 - Testing And Runbooks](./09-testing-and-runbooks.md)

Primary audiences:
- product owner and operator
- application developer
- security reviewer

Auth guidebook rules:
- production Mahita identity uses Google on `https://mahita.ai`
- localhost is for internal development only and defaults to dev bypass
- Schwab callback guidance shown to users is production-only
- role checks must be understood as server-enforced policy, not client state
