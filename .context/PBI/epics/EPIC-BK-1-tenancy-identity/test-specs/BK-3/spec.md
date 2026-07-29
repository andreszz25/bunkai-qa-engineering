# BK-3 — Automation Spec (OAuth Sign-up/Sign-in — GitHub/Google)

Scope: ticket-driven. Source: ATP Candidate verdicts (7) from `/test-documentation`, comment 11918 on BK-3.

## Candidate TCs and disposition

| TC | Title (ATP) | AC | Disposition | Notes |
|----|-------------|----|-------------|-------|
| TC-10 | CSRF state mismatch → 403 | AC-5 | **Automate** | Real param is `bkstate` (query) + `bk_oauth_state` cookie — NOT `state` as the Dev's May-2026 comment pseudocode described. Confirmed live: `bkstate` present, no/mismatched cookie → `403 {"code":"OAUTH_STATE_MISMATCH"}`, cookie cleared. |
| TC-11 | Missing state/code → error | (implicit) | **Automate** | No `code` param → `307` to `/login?error=missing_code`. Matches Dev's pseudocode exactly. |
| TC-12 | Replayed auth code rejected | (implicit) | **Automate** | `code` present, `bkstate` **absent** → skips CSRF check, hits Supabase exchange → `307` to `/login?error=otp_exchange_failed&reason=...`. Any bad/reused code lands here — same partition as "replayed". |
| TC-13 | Expired state token rejected | (implicit) | **Automate** | Distinct from TC-10 — confirmed live: `bkstate` query param **matching** the `bk_oauth_state` cookie value, but not a live/valid init record → `307` to `/login?error=oauth_init_failed`. Different HTTP status + error code than TC-10, so kept as a separate ATC (KATA Rule 3 does not merge distinct partitions). Reproducible with a fabricated matching pair — no real OAuth click-through needed. |
| TC-27 | OAuth buttons enabled | AC-10 | **Automate (merged with TC-28)** | Live DOM confirms real testids: `oauth-github`, `oauth-google` — both enabled, no "soon" state. |
| TC-28 | Login copy updated | AC-10 | **Automate (merged with TC-27)** | Same precondition (page load) + same action (none — passive render check) as TC-27 → KATA Rule 2 (TC Identity = Precondition + Action) requires ONE ATC, not two. Copy paragraph confirmed live: no "ships next sprint" text remains. |
| TC-31 | Open-redirect guard on `next` param | (implicit) | **NOT automated now — scope correction** | Confirmed live: `next` is never read/reflected on ANY error path (missing_code, state mismatch, init failed, exchange failed) — the `safeNext` guard only runs after a **successful** code exchange. That requires a real GitHub/Google consent completion, which needs real OAuth test-account credentials — still absent from `.env` per `test-session-memory.md` (blocked since 2026-07-07). Recommend: leave as Manual until real OAuth test accounts are provisioned, then it becomes automatable as a hybrid `{ test }` E2E, not a pure direct-callback call as the ATP assumed. |

## Live-verified callback contract (`GET /auth/callback`, web-app root — NOT under `/api/v1`)

| Precondition | Response |
|---|---|
| No `code` | `307` → `/login?error=missing_code` |
| `code` present, `bkstate` absent | `307` → `/login?error=otp_exchange_failed&reason=...` |
| `code` present, `bkstate` present, no/mismatched `bk_oauth_state` cookie | `403` JSON `{"code":"OAUTH_STATE_MISMATCH"}`, `Set-Cookie: bk_oauth_state=; Expires=...` (cleared) |
| `code` present, `bkstate` matches `bk_oauth_state` cookie, but init record not live | `307` → `/login?error=oauth_init_failed` |
| `next` param (any path/error branch above) | Never read/reflected — only consulted on the success branch (unverified without real OAuth creds) |

## UI contract (`/login`, live DOM)

Real `data-testid`s (none of this was in `.context/` — pulled live via Playwright since the product repo isn't in this workspace):
`login-email`, `login-continue` (disabled until valid email), `login-magic-link-toggle`, `oauth-github`, `oauth-google`.

## Components

| Component | Status | Change |
|---|---|---|
| `tests/components/api/OAuthApi.ts` | **New** | Layer 3 API component for the 4 callback ATCs (TC-10, 11, 12, 13). |
| `tests/components/ui/LoginPage.ts` | **Extend** | Add 1 ATC (TC-27, covers TC-28) for OAuth button/copy state. Existing `loginSuccessfully`/`loginWithInvalidCredentials` ATCs untouched. |
| `tests/components/api/ApiBase.ts` | **Extend (small)** | `apiGET` needs to (a) hit an absolute URL outside `/api/v1` (the callback lives at the web-app root) and (b) not auto-follow redirects, so the `Location` header can be asserted. Mirrors the existing absolute-URL pattern already used by `apiPOSTForm`. Additive only — no change to any existing caller's behavior. |

## Fixture

`{ api }` for TC-10/11/12/13 (no browser, no OAuth consent needed). `{ ui }` for TC-27/28 (pure UI, no API setup).

## Test data

Generated per-test via `TestContext`'s faker (random UUID-shaped `bkstate` values) — no shared/static fixture file needed. No `.env` creds required for these 4 ATCs (none of them authenticate). Read-only DOM check for the merged UI ATC.
