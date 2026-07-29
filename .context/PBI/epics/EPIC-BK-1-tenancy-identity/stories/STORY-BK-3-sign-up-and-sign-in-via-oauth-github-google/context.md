# BK-3 — Session Notes (QA, non-Jira)

## Session history
- 2026-05-26/27: Shift-Left refinement (Luis Eduardo Flores Villarroel + Andrés). 10 refined ACs, 5 blocker questions raised.
- 2026-05-27: PO (Ely), Dev, Design all answered the 5 blockers same day. Key resolutions:
  - Redirect: NOT `/home` (route doesn't exist). First-time (no workspace) → `/onboarding`. Returning (has workspace) → `/projects`.
  - EMAIL_EXISTS: originally rejected with toast (`/login?error=email_exists`), then **reversed 2026-06-24** — PO enabled Supabase automatic identity linking. Same verified email across GitHub/Google/password now auto-links to ONE account, no block, no toast.
  - Workspace bootstrap failure: persist session, redirect to `/onboarding` (no rollback, no redirect to `/login`).
  - Callback route: single shared `app/auth/callback/route.ts`, discriminated by presence of `?state=` param (OAuth) vs absence (magic-link OTP). No dedicated OAuth route.
- 2026-06-24: PR #56 merged to `staging` (commit `d56316c`). Staging deploy verified.
- 2026-06-24: Ely (PO) ran a live E2E pass and reported: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-9, AC-10 already validated manually.
- 2026-07-07: Nahuel Gomez (Sprint 3 Wave 1 status note) flagged the ticket is stalling on QA sign-off, assigned to Andrés (this user).

## Explicit QA focus (per Ely's "Ready For QA" comment)
1. AC-6 — third-party-cookie-blocked browser → magic-link fallback within 30s (NOT yet manually validated by PO).
2. Real consent-denial in-browser (PO only checked "server cases" via direct callback, not the full in-browser deny flow).
3. Regression: magic-link (BK-2) and password rails still work alongside OAuth — shared callback route is the risk surface (state-param discriminator).

## Open items for this QA pass (not blockers, just things to watch)
- AC-2/AC-7 wording: acceptance-criteria.md's AC-7 already reflects the auto-link reversal; the OLD shift-left ATP draft (acceptance-test-plan.md field, dated 2026-05-26) still assumes the pre-reversal EMAIL_EXISTS-rejection design — Stage 1 planning must author a FRESH ATP, not reuse the stale draft outlines 9/10.
- `shift-left-reviewed` label is dated 2026-05-26 — 42 days old (>30-day freshness window) — Stage 1 runs full phases, does not short-circuit to Phase 4.
- No `master-test-plan.md` in `.context/` — proceeding without it (optional input), noting as `missing_input`.
- TMS modality: jira-native (confirmed — ATP/ATR are Story custom fields `customfield_10067`/others, no Xray Test issues involved).

## Test target
- Staging: https://staging-upexbunkai.vercel.app/login
