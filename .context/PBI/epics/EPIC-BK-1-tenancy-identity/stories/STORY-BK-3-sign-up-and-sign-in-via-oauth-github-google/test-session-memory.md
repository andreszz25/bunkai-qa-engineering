# BK-3 — Test Session Memory (cross-stage, non-Jira)

## TMS Modality
jira-native (confirmed). ATP -> `customfield_10067` on the Story. ATR -> `customfield_...` ATR field on the Story (see `.agents/jira-required.yaml`). No Xray Test issues.

## Environment
- Active env: staging (default)
- WEB_URL: https://staging-upexbunkai.vercel.app
- No session override needed — staging reachable, this is the ticket's own verified deploy target (PR #56 merged commit d56316c).

## Ticket type
Story, Ready For QA, Epic BK-1 (Tenancy & Identity), Priority Medium, 8 points.

## Shift-Left short-circuit check
Label `shift-left-reviewed` present but dated 2026-05-26 (42 days old, > 30-day freshness window) -> Stage 1 runs FULL phases (Phase 1-4), does NOT short-circuit to Phase 4.

## Known implementation facts (from comments.md, load-bearing for Stage 1/2)
- Callback route: single `app/auth/callback/route.ts`, branches on presence of `?state=` (OAuth) vs absence (magic-link OTP, BK-2).
- Redirect logic: has workspace (`workspace_members` rows > 0) -> `/projects`; no workspace -> `/onboarding`.
- EMAIL_EXISTS reversed 2026-06-24: Supabase automatic identity linking is ON. Same verified email across GitHub/Google/password auto-links, no block, no toast.
- Workspace bootstrap failure: session persists, redirect to `/onboarding`, no rollback.
- Test data: needs a shared-email account verified on GitHub AND Google (for the AC-7 auto-link scenario) + a fresh never-used email for AC-1/AC-2 happy paths.

## PO-pre-validated ACs (2026-06-24, live E2E, still to be independently confirmed by QA not just trusted blind)
AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-9, AC-10.

## Explicit QA focus flagged by PO
AC-6 (third-party-cookie block -> magic-link fallback within 30s) — NOT yet validated by anyone.
Real in-browser consent-denial (PO only checked server-side callback shortcut).
Regression on magic-link (BK-2) + password sign-in alongside the new shared-callback branching.

## Stage state
- [x] Session Start
- [x] Stage 1 — Planning (fresh ATP: 32 outlines, see acceptance-test-plan.md)
- [ ] Stage 2 — Execution — BLOCKED: no GitHub/Google OAuth test-account creds in `.env`. Paused by user 2026-07-07, resume once accounts provisioned.
- [ ] Stage 3 — Reporting
