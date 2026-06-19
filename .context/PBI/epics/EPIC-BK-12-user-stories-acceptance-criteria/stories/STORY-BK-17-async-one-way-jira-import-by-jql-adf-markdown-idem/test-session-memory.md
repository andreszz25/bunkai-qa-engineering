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
- Stage 2: BLOCKED — smoke FAIL (TC-POS-01), 2026-06-15. Blocker confirmed across 6 retests over 84min, filed as **BK-142** (Critical, Blocks BK-17). BK-17 transitioned `In Test` -> `BLOCKED` (transition id 13, "defect reported"). Comment posted on BK-17. 1/22 outlines executed (TC-POS-01, FAILED, blocking).
- Stage 3: pending (resumes once BK-142 resolved)

## Stage 2 — Execution

**Env:** Staging
**Started:** 2026-06-15T19:27Z
**Pre-smoke transition:** BK-17 `Ready For QA` -> `In Test` via `acli jira workitem transition --key BK-17 --status "In Test" --yes` (transition id 9, "Start Testing") — executed successfully.

### Smoke — FAILED (BLOCKING)

- TC-POS-01 step 1 (`POST /api/v1/imports {project_id: "ae10a3bd-...", jql: "key in (BK-8, BK-9)"}`) -> **202** `{"import_job_id":"33905236-a3c2-4c79-844a-7c0706cbd33d","status":"queued"}` — envelope correct, this part of AC1/TC-API-01 PASSES.
- TC-POS-01 step 2 (poll `GET /api/v1/imports/{id}`) -> first poll already shows `status: "failed"` (job completes in ~0.1s, no observable `running` state):
  ```json
  {
    "import_job": {
      "id": "33905236-a3c2-4c79-844a-7c0706cbd33d",
      "workspace_id": "baa9bff7-9db2-4ed4-b6b6-b9a86051bfac",
      "project_id": "ae10a3bd-574f-4caf-8076-f19a8e80f5a6",
      "jql": "key in (BK-8, BK-9)",
      "status": "failed",
      "imported_count": 0, "created_count": 0, "updated_count": 0, "skipped_count": 0,
      "errors": [{"code": "jira_unauthorized", "message": "Jira credentials are not configured."}],
      "started_at": "2026-06-15T19:27:56.3+00:00",
      "completed_at": "2026-06-15T19:27:56.398+00:00",
      "created_at": "2026-06-15T19:27:56.281948+00:00"
    }
  }
  ```
- **Root cause (DB cross-check)**: queried `import_jobs` history (10 most recent rows). EVERY row created `>= 2026-06-09` (6 rows, various JQLs incl. `key = BK-1`, `*`, a >2000-char string) fails identically with `errors[0] = {code: "jira_unauthorized", message: "Jira credentials are not configured."}` — this is the exact string from `client.ts:120-122` (`!url || !email || !token` branch, i.e. one or more of `ATLASSIAN_URL`/`ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` is unset on Vercel staging), NOT the HTTP 401/403 branch (`client.ts:143-145`, which would read "Jira authentication failed: <status>").
- **The last known-good job** (`b4b8e74c-...`, `status: completed`, `imported_count: 2`, created `2026-06-05T10:55:04Z`) predates this regression window. So: **Jira creds WERE configured on staging as of 2026-06-05, and are NOT configured as of >= 2026-06-09 through today (2026-06-15)** — a 10-day-old regression, not a one-off blip on this session.
- **Impact**: AC1, AC2, AC3, AC4, AC5 (and any TC that requires the worker to actually call Jira `/search`) are 100% blocked — every `POST /imports` enqueues successfully (202, correct envelope) but the background job fails INSTANTLY with `jira_unauthorized` before any Jira call. This is literally AC6's documented failure mode (`status: failed`, `errors[].code = jira_unauthorized`) — but occurring for EVERY job, not just a deliberate bad-creds test. AC6 is now (accidentally) "verified live" by every other test's failure, which is not useful coverage.
- **Secondary observation (non-blocking, file separately)**: row `28c07149-...` (created 2026-06-09) has a `jql` string far longer than 2000 chars and was still accepted with HTTP 202 (it reached the worker and failed on `jira_unauthorized`, not on route-level validation). This suggests the `CreateBodySchema` `jql: z.string().trim().min(1).max(2000)` validation (`route.ts:17`) may NOT be enforced as expected, OR this row predates the validation being added. **Needs confirmation via TC-BND-01/TC-API-03** — but TC-BND-01 itself is now also blocked from reaching a clean `completed`/`failed`-for-the-right-reason state, since ALL jobs fail on creds first. The 400-vs-202 status code for the length boundary is still independently testable (route validation runs BEFORE the `after()` worker), so TC-BND-01/TC-API-03/TC-API-04 (pure request-validation TCs that don't depend on the worker reaching Jira) MAY still be executable — but per the smoke-fail STOP instruction, this session does not proceed to verify even those.
- **Evidence**: `evidence/TC-POS-01-import-post.json`, `evidence/TC-POS-01-poll-failed.json`, `evidence/SMOKE-jira-creds-regression-import-jobs-history.json`

### Verdict: NO-GO — STOP

Smoke (TC-POS-01) FAILED on step 2 (poll-to-completed / counts). Per `exploration-patterns.md` §4.3, this is an environment-level blocker — STOP, do not enter deep UI/API/DB exploration. 1/22 outlines executed (TC-POS-01 — FAILED, blocking). The other 21 outlines remain NOT RUN this session.

### Findings (carry to Stage 3)
- **Bug 1 (NEW, blocking)**: Staging Jira credentials (`ATLASSIAN_URL`/`ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN`) are no longer configured/valid on Vercel staging — every `import_jobs` row created since 2026-06-09 (including today's TC-POS-01) fails instantly with `errors[0].code = "jira_unauthorized"`, `message = "Jira credentials are not configured."` (the missing-env-var branch, `client.ts:120-122`). Last known-good job: `b4b8e74c-...` (2026-06-05). This blocks AC1-AC5 entirely — none of BK-17's core import behavior (counts, idempotency, component routing, Inbox fallback, chunking) can be verified live until creds are restored. Severity: **Critical** (core feature 100% blocked, no workaround within this environment). This is an infrastructure/config regression, not a BK-17 code defect — likely candidate file BK-84's auth-gateway redeploy window (2026-06-07 to 2026-06-09) coincides with when creds appear to have dropped out, but root cause needs Ely/infra confirmation, not code-level fix.
- Obs 1 (non-blocking, needs confirmation once unblocked): row `28c07149-...` (2026-06-09) shows a >2000-char `jql` accepted with 202 instead of the expected 400 from `CreateBodySchema.jql.max(2000)` (`route.ts:17`) — re-verify with TC-BND-01/TC-API-03 once the creds blocker is resolved, as this could be either a real validation gap or stale data from before the validator was added.

### Retest log — 2026-06-15, 5 consecutive attempts, all identical `jira_unauthorized`

| # | Job ID | Timestamp (started_at) | Context | Result |
|---|---|---|---|---|
| 1 | `33905236-...` | 19:27:56Z | original Stage 2 smoke | `jira_unauthorized` |
| 2 | `d3f02f40-...` | 20:16:18Z | re-verify before any infra change | `jira_unauthorized` |
| 3 | `59556fdc-...` | 20:34:35Z | after user added vars to Vercel (scope unspecified, no redeploy yet) | `jira_unauthorized` |
| 4 | `87303b91-...` | 20:39:54Z | after 1st redeploy | `jira_unauthorized` |
| 5 | `87fbca69-...` | 20:45:24Z | after vars added to Preview scope explicitly | `jira_unauthorized` |
| 6 | `e10b673e-...` | 20:51:08Z | after vars added to Production scope (confirmed: `staging-upexbunkai.vercel.app` domain = Production env) + redeploy | `jira_unauthorized` |

`lib/env.ts:36-38` — `ATLASSIAN_URL: z.string().url().optional()`, `ATLASSIAN_EMAIL/API_TOKEN: z.string().optional()`. If `ATLASSIAN_URL` were set to an invalid (non-URL) string, `EnvSchema.safeParse` would fail and `lib/env.ts` throws at module load (`[bunkai/env] Invalid environment variables`) — would 500 the WHOLE app (not just imports). Since `/health`, `/me`, `/auth/signin` all return 200, the app boots fine, so either all 3 ATLASSIAN_* vars are still `undefined`, OR `ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` are set to an EMPTY STRING `""` (passes `z.string()`, but `!""` is `true` -> still trips the `client.ts:120` guard while `ATLASSIAN_URL` could be a valid non-empty URL).

**Open question for infra (Ely)**: after 2 redeploys + vars confirmed in Production scope, error signature unchanged byte-for-byte across 6 jobs spanning 84 minutes. Suggests either (a) the redeployed build isn't the one served by `staging-upexbunkai.vercel.app` (domain pinned to an older deployment, not auto-aliased to latest Production), or (b) one of the 3 vars was saved with an empty value in the Vercel UI.

**UNCONFIRMED lead (2026-06-15T21:00Z, user flagged as not certain)**: user attempted to add `staging-upexbunkai.vercel.app` as a domain on their accessible Vercel project ("qa-engineering") and got: *"staging-upexbunkai.vercel.app is already assigned to another team. Use a different domain or transfer it."* — possible explanation that the domain belongs to a different Vercel team than the one accessible, which would mean today's 6 retries tested an unrelated project. **User asked NOT to treat this as confirmed.** Do not cite as root cause until verified. Net status unchanged: blocker is still `jira_unauthorized` on every staging import job, root cause still TBD pending infra investigation.

### Bug filed — BK-142 (2026-06-15T21:10Z)

- **BK-142** "[BK-17] Staging Jira import fails instantly with jira_unauthorized — ATLASSIAN_* credentials not configured in staging deployment" — created in project BK, type Bug, Severity=Crítica, Error Type=Integration, Test Environment=Staging. Description/Actual/Expected/Evidence/Workaround fields filled via ADF. Does NOT cite the unconfirmed Vercel-team lead — root cause left as "ATLASSIAN_* env vars not configured/effective in staging deployment".
- Linked: **BK-142 Blocks BK-17** (issue link id 10578, verified `outwardIssueKey: "BK-142"` on BK-17's link list).
- Comment posted on BK-17 (English, ADF) summarizing the Stage 2 STOP, evidence, regression window, and next steps.
- BK-17 transitioned `In Test` (10041) -> `BLOCKED` (10026) via transition id 13 ("defect reported"), per `qa.formal_blocked_gate: true`. Verified via `acli jira workitem view BK-17 --json` -> `status.name = "BLOCKED"`.
- Stage 2 STOPS here. Resume once BK-142 is resolved (staging `ATLASSIAN_*` vars restored + redeploy verified).

### Re-verification retest (2026-06-15T20:16Z) — blocker still active, NOT a creds-value issue

- Fresh signin (PAT minted inline via `POST /auth/signin`, scopes `atc:read,atc:write,run:execute,workspace:admin`) -> `POST /api/v1/imports {project_id: "ae10a3bd-...", jql: "key in (BK-8, BK-9)"} -> **202** `{"import_job_id":"d3f02f40-8b01-4c10-aa5f-29b2ced4dc8a","status":"queued"}`.
- Poll (3s later) -> **200**, `status: "failed"`, `errors[0] = {code: "jira_unauthorized", message: "Jira credentials are not configured."}` — identical signature to the 2026-06-15T19:27Z run. Confirms regression is still live, NOT a one-off.
- **Conclusion**: staging Vercel deployment env is STILL missing/wrong `ATLASSIAN_URL`/`ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` as of 2026-06-15T20:16Z (8th day of the regression window, since ~2026-06-09). Local QA repo `.env` creds remain independently verified live against real Jira (`GET /rest/api/3/myself` -> 200) — confirms the gap is staging-config, not credential rotation.
- **Evidence**: `/tmp/bk17-signin.json`, `/tmp/bk17-import-post2.json`, `/tmp/bk17-import-poll.json`.

### Credential verification (2026-06-15T19:45Z) — root cause narrowed to staging config, not bad credential values
- Confirmed `lib/env.ts` expects exactly `ATLASSIAN_URL` / `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN` (all `z.string().optional()` — missing is a soft-fail, surfaces as `jira_unauthorized` per the `client.ts:120-122` guard, not an app-boot crash).
- The same var names + values are present in the QA repo's local `.env` (`ATLASSIAN_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`).
- Tested those exact local credentials directly against the real Jira Cloud API: `GET {ATLASSIAN_URL}/rest/api/3/myself` with `Authorization: Basic base64(EMAIL:TOKEN)` -> **HTTP 200**. The credential VALUES are valid and live.
- **Conclusion**: this is NOT "our credentials are wrong/expired" — it's that staging's Vercel deployment env is missing/has different `ATLASSIAN_*` values than the ones that work. Confirms the finding is a real, reportable **infra/config-drift blocker** (Critical, blocks AC1-AC5), root cause still narrowed to "Vercel staging env vars dropped sometime 06-07..06-09", not a credential-rotation issue on the Atlassian side.

## Smoke Test Retest — 2026-06-15 — GO

BK-84 fix (commit `226fc9d`, ADR-0001 unified auth gateway) verified on staging with a fresh PAT:

| Route | Before (2026-06-07) | After (2026-06-15) |
|---|---|---|
| `GET /me` (control) | 200 | 200 |
| `GET /workspaces` (control) | 200 | 200 |
| `GET /tokens` | 401 | 200 |
| `GET /imports/{nil-uuid}` | 401 | 404 `not_found` |
| `POST /imports {}` | 401 | 422 `validation_failed` |
| `POST /projects/{id}/modules {}` | 401 | 422 `validation_failed` |
| `POST /me/active-workspace {}` | 401 | 422 `validation_failed` |
| `POST /workspaces/{id}/projects {}` | 401 | 422 `validation_failed` |

No 401s on any route. Auth gate passes; the original 22-outline ATP execution can proceed using project_id `ae10a3bd-574f-4caf-8076-f19a8e80f5a6` (BK-9 Module Test Project, workspace BK-9 QA Testing). BK-84 closed via `ReTest Passed`, retest comment posted. BK-17 comment posted noting blocker resolved.

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
