# BK-17 — Test Session Memory

Shared payload across all 4 sub-agent dispatches for this sprint-testing session.

---

## Environment
- Active env: staging
- WEB_URL: https://staging-upexbunkai.vercel.app
- API_URL: https://staging-upexbunkai.vercel.app/api/v1
- DB_MCP: staging-dbhub (connected, schema verified)
- API_MCP: staging-openapi (connected, 35 endpoints listed incl. POST/GET /api/v1/imports)
- Credentials: `.env` → `STAGING_USER_EMAIL` / `STAGING_USER_PASSWORD` (authenticated as `bunkai-staging-user@veluarzooo.resend.app`, GET /api/v1/me → 200, active workspace "BK-9 QA Testing")

## TMS Modality
jira-native (Modality B) — no Xray. ATP/ATR live as plain Jira comments on the Story; TCs as native `Test` issue type linked to the regression epic. Resolved from prior BK-9 session memory.

## Story Summary
**BK-17 — Jira Import | Pull Jira issues by JQL** (Epic BK-12, Story Points 5, Status Ready For QA)

As a Project lead, pull a batch of Jira issues into Bunkai by JQL, with idempotent re-runs and component-to-Module mapping, to seed a Project from an existing Jira backlog. Import is async: API returns `import_job_id` immediately; a background process (Vercel `after()`, NOT a cron Edge Function as originally planned) pages through Jira `/search`, converts ADF descriptions to Markdown, extracts ACs heuristically, maps components to Modules (or routes to auto-created "Inbox"), and upserts `user_stories` keyed on `external_id`.

## AC Verification Guide (from Ely's "Ready For QA" comment — authoritative as-built spec)

| # | Scenario | Expected result |
|---|---|---|
| AC1 | Start + poll | Import with a JQL returning a handful of Story issues → dialog goes `queued → running → completed`, `imported_count` = number of issues, `errors` empty |
| AC2 | Idempotent re-run | Run the SAME JQL again → completes with `created_count = 0`, `updated_count = N`, NO duplicate stories |
| AC3 | Component routing | Issue whose Jira component name equals a Module name in the project → story lands under that Module |
| AC4 | Inbox fallback | Issue with no matching component → story lands under auto-created "Inbox" module (NOT reported as an error) |
| AC5 | Chunking | JQL returning >100 issues pages through (≤100/page); final `imported_count` = total |
| AC6 | Bad credentials | No/invalid Jira creds configured → job ends `failed` with `errors[].code = jira_unauthorized` |

## Endpoint Contracts (confirmed in code, `app/api/v1/imports/`)

- `POST /api/v1/imports` — body `{ project_id: uuid, jql: string (1-2000 chars) }` → **202** `{ import_job_id, status: 'queued' }`. Member-only (RLS INSERT policy → `forbidden`/`not_a_member` on viewer). At most ONE active (`queued`/`running`) import per project — **race-proof via DB partial UNIQUE index** `import_jobs_one_active_per_project` (migration 0020); route does fast-path SELECT 409 check AND catches `23505` → both map to **409** `{ reason: 'import_in_progress' }`.
- `GET /api/v1/imports/{id}` — **200** `{ import_job: { id, workspace_id, project_id, jql, status, imported_count, created_count, updated_count, skipped_count, errors[], started_at, completed_at, created_at } }`. Member-only via SELECT RLS (outsider → 404, row hidden). 400 on non-UUID id, 404 on missing/inaccessible job.

## DB Ground Truth (queried 2026-06-07, staging-dbhub)

- `import_jobs` table: confirmed schema per migration 0019 + 0020. Columns: id, workspace_id, project_id, jql, status (check: queued|running|completed|failed), next_page_token, imported_count, created_count, updated_count, skipped_count, errors (jsonb), started_at, completed_at, created_at.
- **Existing row**: `{id: b4b8e74c-..., project_id: ed871b20-aacb-49bb-b636-88bbd00b5440, status: completed, jql: "key in (BK-8, BK-9)", imported_count: 2, created_count: 2, updated_count: 0, skipped_count: 0, errors: [], created_at: 2026-06-05T10:55:04Z}`.
- **Resolved**: `project_id ed871b20-...` = project "Smoke Checkout", workspace "Bunkai Smoke QA" (`57488f20-8bdf-4716-926c-d76078e14bfc`), sole member `user_id c3720eaa-...` (owner). **NOT reachable** by the current QA session's user (`c4cb73a7-4a70-4460-b146-7ba823934dc0`, active workspace "BK-9 QA Testing" `baa9bff7-...`).
- **Resolved test project for THIS session**: "BK-9 Module Test Project" (`ae10a3bd-574f-4caf-8076-f19a8e80f5a6`), workspace "BK-9 QA Testing", owned by the current user. `import_jobs` table is EMPTY for this workspace — clean slate, no idempotency collisions.
- "Smoke Checkout" already has an Inbox module (root-level, `position: 2`) alongside "Payments" and "Refunds and Credits" — created by a prior (BK-9-session) import run; confirms `ensureInbox` places Inbox at root.
- Live Jira credentials ARE configured server-side on staging (the existing `completed` job with real keys BK-8/BK-9 proves it) — `ATLASSIAN_URL`/`ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` set in Vercel per Ely's note.
- Data hygiene: ~33 leftover "BK9 Integration <timestamp>" workspaces under the active user — test-automation residue, not import-related, noted but not actionable for this session.

## Session State
- Session Start: in_progress (2026-06-07)
- Stage 1: completed (ATP authored, 22 outlines)
- Stage 2: PAUSED — escalated as BK-84 (linked blocks→BK-17)
- Stage 3: pending

## Smoke Test Verdict — 2026-06-07T13:53Z — NO-GO (BLOCKING)

**Result: STOP — environment-level auth defect blocks all of Stage 2.**

- `GET /api/v1/health` → 200 `{"ok":true,"env":"staging"}` — staging IS reachable.
- `POST /api/v1/auth/signin` → 200, returns valid session + freshly-minted PAT (`bk_pat_*`). Confirmed in DB: `access_tokens` row not revoked, no expiry, `last_used_at` populated (token genuinely accepted at least once).
- `GET /api/v1/me` with `Authorization: Bearer <PAT>` → **200** (user + workspaces + active_workspace_id returned correctly).
- `GET /api/v1/workspaces` with same PAT → **200**.
- **`POST /api/v1/imports`, `GET /api/v1/imports/{id}`, `POST /api/v1/workspaces/{id}/projects`, `POST /api/v1/projects/{id}/modules`, `POST /api/v1/me/active-workspace`, `GET /api/v1/tokens` — ALL return 401 `{"code":"unauthorized","message":"You must be signed in."}` with the SAME valid, unrevoked, unexpired PAT** that succeeds on `/me` and `/workspaces`.
- Re-tested with a brand-new PAT minted via a fresh `signin` call — identical 401s. Rules out token staleness/expiry/clock-skew.
- `api/schemas/auth.types.ts:70,81` (this repo's own type facade, presumably written from prior framework integration work) explicitly documents: *"PAT token (bk_pat_*) for Bearer auth on requireAuth endpoints"* / *"access_token = PAT token... for Bearer auth on requireAuth endpoints"* — i.e., our usage matches the documented contract exactly.
- Conclusion: **the `requireAuth` middleware accepts the PAT bearer only for a narrow Identity-tier whitelist (`/me`, `/workspaces`) and rejects it for essentially every "member-only"/owned-resource route** — including the entire Imports surface this story is about, AND unrelated routes (Projects, Modules, even the user's own `GET /tokens`). This is broader than BK-17 — it looks like a staging-wide regression in the bearer-auth middleware for scoped/mutating routes, not a BK-17-specific defect.
- **Why this is BLOCKING per Gotcha #4 / S7**: `/me` itself returns 200 (so the literal smoke-check #1 instruction technically passes), but the actual feature surface under test (`POST /imports`, `GET /imports/{id}`) is 100% unreachable — every one of the 22 ATP outlines requires at least one authenticated call to these routes. Proceeding would either produce zero executable TCs or false-positive "FAILED" results that are actually an auth-layer artifact, not BK-17 behavior. STOP per the graduated triage rule (smoke-equivalent failure of the feature surface = No-Go).
- **Hypothesis for follow-up** (not yet root-caused — needs a session-cookie-capable browser flow, e.g. via `/playwright-cli`, to confirm whether the SAME user CAN reach `/imports` through the web UI with cookie-based Supabase session auth — which would mean the gap is PAT-bearer-specific and CLI/headless-only, not a full outage): if the UI works, this is a "PAT auth scope gap" (server bug or PAT scope misconfiguration — note PAT scopes are `atc:read, atc:write, run:execute, workspace:admin`, NOT `imports:*` or `projects:*` — possibly the route's `requireAuth` checks for scopes the signin-minted PAT doesn't carry, OR ignores PAT entirely for non-whitelisted routes). If the UI ALSO 401s, this is a full staging outage on protected routes.
- **Evidence**: raw request/response captures saved at `/tmp/bk17-atp/{login.json, login2.json, me.json, post_probe.json, post_probe2.json, known_job2.json, malformed.json, create_proj.json, create_mod.json, tokens.json}` (ephemeral working dir, not under repo `evidence/` — re-run-able from this report's repro steps).

## Key Pre-Test Findings (code review — see context.md for full file:line detail)

1. **AS_BUILT_DEVIATES_FROM_ARCHITECT**: shipped uses Vercel `after()` + env-var creds + admin client, NOT the planned `pg_cron` Edge Function + `workspace_integrations`/Vault. Confirmed intentional (Ely's comment) — not a defect.
2. **CONCURRENT_IMPORT_RACE_CLOSED**: 409 `import_in_progress` is enforced by a DB partial UNIQUE index (`0020_import_jobs_one_active.sql`), not just an app-level check — race-proof. Resolves shift-left Gap #5.
3. **NO_CRASH_RESUME_NO_TIMEOUT_SWEEPER**: crash recovery = "re-run is safe" (Option A), confirmed by Ely. BUT `next_page_token` is persisted yet never read back on restart, AND there is no timeout sweeper — a worker that dies mid-job leaves the row stuck in `running` forever. Cannot be exercised live (can't force a mid-job crash); document as residual gap in ATR, not a failing test.
4. **JIRA_AUTH_VS_GENERIC_FAILURE_CODES**: `jira_unauthorized` only fires for missing creds or HTTP 401/403; a 429-exhaustion or other Jira error surfaces as generic `job_failed`/`JiraError` — AC6 specifically requires `jira_unauthorized`, which may be impossible to trigger live since creds are confirmed working server-side (would need to break shared staging config).
5. **AC_EXTRACTION_DESCRIPTION_ONLY**: confirmed — ACs only parsed from description Markdown body; custom-field ACs import as 0 (expected per Ely).
6. **IDEMPOTENCY_ADDITIVE_ONLY**: re-import upserts title/description but does NOT touch module placement/status; AC reconciliation only appends new (by lower-title) criteria — never removes/restores. Worth confirming this exact behavior live during AC2.
