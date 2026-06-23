# BK-27 — QA Session Notes (context.md)

> Hand-authored. Not Jira-synced. Companion to the read-only caches in this folder.

## Story summary

"New Test" builder: a QA engineer (Elena) chains an ordered sequence of ATCs from her workspace's library into a named **Test**. Same surface (one rulebook) for UI form and headless PAT-authed clients (Karim persona). Implemented and merged to `staging` (PR #40, merge `54749ba`); auto-deployed to staging.

## AC summary (4 ACs + E1/E2)

- **AC1** — Assemble a Test from 3 ATCs; chain order preserved; activity_log entry written (writer now in-scope per PO Q4 answer, absorbed into this story's RPC).
  - Scenario 1.1: 3 distinct ATCs in selected order → 1 `tests` row + ordered `test_steps` 1-2-3 + activity_log entry.
  - Scenario 1.2: duplicate ATC in chain (e.g. `[A, B, A]`) → both positions persist, no de-dup (sequence, not set).
- **AC2** — Save blocked without ≥1 ATC; title rules enforced server-side.
  - Scenario 2.1: zero ATCs → blocked, verbatim copy, no row, server-revalidated.
  - Scenario 2.2: whitespace-only title → blocked.
  - Scenario 2.3: 201-char title rejected, 200-char accepted.
- **AC3** — Double-submit / retry does not duplicate.
  - Scenario 3.1 (TC-12): rapid double-click "Save" → exactly one `tests` row.
  - Scenario 3.2 (TC-16/17): headless PAT retry with same `Idempotency-Key` → one Test, cached/identical response on replay.
- **AC4** — Cross-workspace ATC reference rejected, non-disclosing.
  - Scenario 4.1: ATC owned by a foreign workspace → rejected; response byte-identical to a wholly-nonexistent ATC id (INV-3 non-disclosure).
- **E1** — Viewer via headless API → 403, no Test created (server-side enforced regardless of UI affordance).
- **E2** — Binding instant: Test binds to the workspace active **at save-commit time** (not form-open). Server reads active workspace from session at submit, stamps `tests.workspace_id`, then re-validates every chained ATC under that same workspace's RLS.

## Dev-flagged QA focus areas (from staging handoff comment, 6/12/2026)

These are the 4 priority areas the dev explicitly called out for staging QA — Stage 2 execution should prioritize these:

1. **Builder flow E2E with duplicate ATC** — assemble a Test with 3 ATCs incl. one duplicate; chain order must equal selection order; Test appears in the Project's Tests/Explorer group.
2. **Double-submit dedup (TC-12)** — rapid double-click on "Create Test" → exactly one Test row, not two.
3. **Headless retry with same Idempotency-Key (TC-16/17)** — `POST /api/v1/tests` with PAT + same `Idempotency-Key` header twice → one Test created, second response identical/cached (per `idempotency_keys` 24h TTL semantics); **omitting `workspace_id` on a token-authenticated call → 422** (token-authed calls have no active-workspace cookie, so `workspace_id` becomes required — confirmed in `app/api/v1/tests/route.ts`).
4. **Validation copy verbatim** — empty chain, whitespace-only title, 201-char title (exact strings below).

## Verbatim copy to assert (from BK-27 Implementation Plan Appendix, Content Writing table)

| Context | Exact copy |
| --- | --- |
| Empty chain (server + UI, byte-identical) | `A Test must include at least one ATC.` |
| Foreign/nonexistent ATC (server, rendered verbatim by UI) | `One or more selected ATCs are not available in this workspace.` |
| Title required | `Title is required.` |
| Title too long | `Title must be 200 characters or fewer.` |
| Builder heading | `New Test` |
| Builder helper line | `Chain ATCs from your workspace library — selection order is run order.` |
| UI soft cap | `Chains are limited to 100 ATCs in the UI.` |

Never assert/expect the strings "test case", "test component", or "published ATC" anywhere in UI/copy (glossary casing rule).

## Non-disclosure 404 contract (AC4 / INV-3)

- **Status code: 404 `not_found`** for BOTH a foreign-workspace ATC AND a wholly-nonexistent ATC id — application code never branches on "exists elsewhere" vs "doesn't exist"; RLS makes both reads return `null` via `.maybeSingle()`, collapsing to the same `ApiError('not_found', ...)`.
- A 403 would leak existence (only returned when server confirms the resource exists) — explicitly rejected by Dev (Q5 answer).
- Response body must NOT echo the ATC id or any "belongs to another workspace" phrasing.
- SQLSTATE map (per `lib/tests/errors.ts`): 42501 → 403 `forbidden`; 45120 → 422 `chain_empty` + exact copy; 45121 → 422; 45122 → 404 `not_found` + exact copy, no id echo.
- Test must verify: response for "ATC in another workspace" and response for "ATC id that never existed" are byte-identical (status + body).

## Confirmed implementation (from sibling repo `../upex-bunkai-tms`, staging branch @ `54749ba`/`f05c4f3`)

- Migration: `supabase/migrations/0024_tests.sql` — `tests`, `test_steps` tables + `bunkai_create_test` SECURITY DEFINER RPC + RLS policies.
- API route: `app/api/v1/tests/route.ts` (+ `route.openapi.ts`) — `POST /api/v1/tests`, wires `beginIdempotentRequest` / `recordIdempotencyResult` / `discardIdempotencyResult` from `lib/api/idempotency.ts`.
- UI builder: `app/(app)/projects/[projectSlug]/tests/new/page.tsx` → route `/projects/{slug}/tests/new`.
- Validation: `lib/tests/validation.ts` (+ `validation.test.ts`).
- Error mapping: `lib/tests/errors.ts` (+ `errors.test.ts`).
- RLS isolation suite: `lib/tests/rls-isolation.test.ts`.
- Idempotency: token-authed calls (no active-workspace cookie) require `workspace_id` in body — omitted → 422 `validation_failed` ("workspace_id is required for token-authenticated calls.").

## Test-data candidates found on staging (2026-06-15, via `staging-dbhub`)

**GAP — staging currently has only 1 ATC total across the entire database.** This blocks AC1 (needs ≥3 ATCs in one workspace) and AC4 (needs an ATC in a different workspace) until QA seeds data.

- Workspace with the only existing ATC: **"QA BK-8 Project Tests"** (slug `qa-bk8-1780533325`, id `bc75c0d4-6d92-4d3f-a92f-f41e4b1774fe`) — 15 projects, 1 ATC: **"ATC Example"** (id `11655bea-f8e4-4d23-8bda-44a463118eae`, status `unrun`, not archived).
- Candidate foreign workspace for AC4: **"QA BK-8 Second WS"** (slug `qa-bk8b-1780534540`, id `3fea0e11-ff28-4d84-93bd-fcb0c511561c`) — has 3 projects but 0 ATCs currently.
- `tests` table: 0 rows (confirms table is live and empty — sanity check passed).
- All 72 workspaces appear single-member (owner-only) — consistent with one staging PAT user owning the whole tree; could not resolve the exact `auth.users` row for `STAGING_USER_EMAIL` (no `auth` schema read access via `staging-dbhub`; no `public.profiles`/`users` view found).

### Stage 1/2 action item (seed test data)

Before Stage 2 execution, seed:
1. 2 more ATCs in `qa-bk8-1780533325` (to reach ≥3 selectable ATCs for AC1's chain-of-3 and Scenario 1.2's duplicate-ATC chain — can reuse "ATC Example" as one of the 3 positions for 1.2).
2. ≥1 ATC in `qa-bk8b-1780534540` (or any other workspace) to serve as the foreign-workspace `ATC-X` for AC4's non-disclosure test.

## Open / blocked items carried from shift-left

- E2 (binding instant) — resolved by Dev: workspace active **at save-commit time**, stamped server-side from session. Testable as written.
- Activity-log write (Gap #4) — PO/Dev agreed it's now in-scope, absorbed into BK-27's RPC (per implementation plan appendix). Verify the `activity_log` row is actually written on successful creation during Stage 2.
- Idempotency wiring (Ambiguity #1 / Gap "feasibility") — confirmed wired: `lib/api/idempotency.ts` is imported by `app/api/v1/tests/route.ts`.
