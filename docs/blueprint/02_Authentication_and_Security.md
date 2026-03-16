# 02 - Authentication and Security Blueprint

Status: Historical blueprint. Superseded in practice by [docs/current_state_baseline.md](../current_state_baseline.md), [docs/execution/mahita_recovery_program.md](../execution/mahita_recovery_program.md), and [docs/security/enterprise_security_program.md](../security/enterprise_security_program.md).

## Executive Summary
This document details the critical security implementations for safeguarding brokerage access and the application backend since it operates via a public DNS address.

## 1. Authentication Configuration
*   **Provider**: NextAuth.js employing strictly Google OAuth.
*   **White-label Execution**: The `signIn` NextAuth callback must strictly validate the `profile.email` against a single environment variable `ALLOWED_EMAIL` representing the sole system owner. All other authenticated Google profiles must be unequivocally rejected (return `false`).
*   **Route Protection**: An edge `proxy.ts` should enforce authenticated access to protected product and API surfaces.

## 2. Broker Keys & Secrets
*   **Cardinal Rule**: Platform API Keys (Schwab, Alpaca) must **NEVER** be persisted in the standard database schema (SQLite/Postgres).
*   **Environment Storage**: Key material is strictly locked into the host machine's `.env.local` context, heavily restricted from git source tracking or UI display points.

## 3. Defense against Injection (The AST rule)
*   **Code Injection Risks**: Since users are providing "algorithmic logic" via the frontend, the backend must avoid using JavaScript `eval()`, `new Function()`, or un-sandboxed VMs.
*   **Strict Mapping**: The Next API translates the provided JSON AST rulebook into discrete comparative mathematical checks mapped to technical indicator dictionaries.
