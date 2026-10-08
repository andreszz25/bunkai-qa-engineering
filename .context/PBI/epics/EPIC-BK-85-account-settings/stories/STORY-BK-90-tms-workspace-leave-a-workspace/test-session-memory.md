# Test Session Memory: BK-90

> Shared memory across sub-agents. Each stage updates its section.
> Last updated: 2026-10-08 by Stage 1 Planning

## Ticket

- ID: BK-90
- Title: TMS-Workspace | Leave a workspace
- Type: Story
- Priority: Medium (5 SP)
- Dev: Ely (PRs #72, #74) | Assignee: Andrés Daniel Cumare Morales
- Project: BK (Bunkai) | Epic: BK-85 Account & Settings
- Platform: Web (Next.js + Supabase)
- Sprint: n/a (not in synced fields)
- Status: Ready For QA
- Labels: implementation-plan-ready, shift-left-2026-06-10, shift-left-reviewed

## TMS Modality

jira-native (user decision 2026-10-08; `.agents/project.yaml` `testing.tms_cli: acli`). ATP -> Story field `{{jira.acceptance_test_plan}}`; ATR -> Story field `{{jira.acceptance_test_results}}`; Stage 1 = TC outlines only (no `Test` work items until Stage 4). Xray not used (XRAY_* keys empty). Atlassian site = upexgalaxy72.

## Story Explanation

This story lets a user remove themselves from a workspace they no longer need, from the Settings > Workspaces page (`/settings/workspaces`). Each workspace row gets a "Leave" action. Clicking it opens a confirmation dialog that names the workspace (name + slug) and asks the user to type the workspace's exact name before the red "Leave {name}" button unlocks. On confirm, the user's membership is deleted, the row disappears, and if that workspace was the active one, the app switches to the user's oldest remaining workspace and announces "You left X. Y is now your active workspace."

Two guards stop users from stranding a workspace or themselves. A sole owner (no other active owner) sees "Can't leave — You're its only owner. Ownership transfer isn't available yet." instead of the button. A user who belongs to only one workspace sees no Leave action at all (this replaced an earlier idea of sending them to onboarding). A co-owner can leave as long as another active owner remains. Both guards are also enforced server-side (HTTP 409 with `last_membership` / `sole_owner`). Leaving never deletes the workspace's content (ATCs, stories, modules, projects stay), but the user's Personal Access Tokens scoped to that workspace are revoked in the same transaction. Leaving via a PAT (API bearer) is not allowed — browser session only.

We will test the 5 acceptance scenarios: confirmation + active-workspace fallback, sole-owner block, only-workspace block, no-cascade content + PAT revoke, and co-owner leave — across UI, API (`DELETE /api/v1/workspaces/{id}/membership`) and DB (`workspace_members`, `access_tokens`). Key team decisions: the shipped mockup overrode two earlier answers (only-workspace = block; confirmation = type-to-confirm). The AC field still lists the confirm mechanism as "open", but the code implements type-to-confirm.

## Acceptance Criteria (5 scenarios — source: acceptance-criteria.md, reconciled 2026-08-05)

1. Scenario 1 — Leaving a workspace asks for confirmation (names workspace; membership removed; active falls back per BR-1; chrome reflects new active).
2. Scenario 2 — Sole owner cannot leave (action unavailable + explanatory message).
3. New Scenario A — Only workspace: Leave does not render; no dialog reachable (CORRECTED from `/onboarding`).
4. New Scenario B — No cascade on authored content; user loses access; workspace-scoped PAT auto-revoked in same transaction.
5. New Scenario C — Co-owner can leave when another owner remains; remaining owner unchanged.

ATP DRAFT (acceptance-test-plan.md): 6 outlines — Positive 3, Negative 2, Integration 1.

## Team Discussion

- 2026-06-10 [Andrés]: shift-left refinement + 3 open questions; role-played (disclaimed) answers: count-based gate, `/onboarding`, PAT revoke, simple confirm dialog.
- 2026-07-30 [Ely]: mockup `settings-workspaces.html/png` (attachment 10199).
- 2026-07-31 [Ely]: PO ratified role-played answers; then CORRECTION — mockup precedence: only-workspace = BLOCK, confirm = TYPE-TO-CONFIRM. Gate + PAT unchanged.
- 2026-07-31 [Ely]: dev complete — PR #72 + #74 merged to staging; review.md Spec Compliance Matrix = all 5 covered.
- 2026-08-05 [Andrés]: AC/ATP reconciled; confirm-dialog mechanism kept OPEN (only open question).

## Environment

- Web: https://staging-upexbunkai.vercel.app | API: https://staging-upexbunkai.vercel.app/api
- WEB_URL_OVERRIDE: none
- API_URL_OVERRIDE: none
- DB MCP: staging-dbhub | API MCP: staging-openapi
- Credentials: `.env` keys `STAGING_USER_EMAIL` / `STAGING_USER_PASSWORD` (single account only)
- Reachability: verified by orchestrator (web 307 -> login, /api/docs 200)

## Test Data

Seeded 2026-10-08 via API (2 personas — Supabase SMTP rate limit blocked P3-P5 OTP emails; main `STAGING_USER_EMAIL` is magic-link only, password disabled in `.env`).

Credentials: `.env` -> `BK90_P1_EMAIL`, `BK90_P2_EMAIL`, `BK90_PERSONA_PASSWORD` (sign in via `POST /api/v1/auth/signin`; UI session via injected `sb-<ref>-auth-token` cookie — UI login is magic-link only).

| Persona | user_id | Memberships |
|---|---|---|
| P1 | `7f986884-86ee-4067-b953-2201f590e091` | BK90 P1 Home (owner, base — never leave) · BK90 Shared (member) |
| P2 | `bceb1db2-5395-4dfa-aea1-23cd20b99ecb` | BK90 Shared (sole owner) — ONLY workspace (Scenario A state) |

| Workspace | id |
|---|---|
| BK90 P1 Home (`bk90-p1-home`) | `552c093b-e881-44de-9b13-69130e240fd9` |
| BK90 Shared (`bk90-shared`) | `8e6d068d-032b-4d79-a06f-b3088fdfe850` |

P1-authored content in BK90 Shared: project `390fe0b5-9273-4df8-ac11-bac847dc3c0a`, module `c0772f20-36b5-4ea8-8832-6afb15495c4d`, story `43a1d16a-c5c2-43d9-bdd5-981f6884310d`, AC `58bf1a38-d9d0-44ed-b2af-74a9327ce382`, ATC `ff906e82-7671-4557-862d-42798ecc5e2b`.

P1 PATs: `bk90-p1-scoped-shared` (ws=Shared, expect REVOKED on leave) · `bk90-p1-scoped-home-control` (ws=Home, expect untouched) · `bk90-setup` (ws=null, expect untouched).

Execution order constraints:
1. Scenario A FIRST (P2 has exactly 1 workspace). Do not add P2 to any other workspace before A runs.
2. Then Scenario 2 (P2 sole owner of Shared) needs P2 in >=1 other workspace -> create W_CO after A.
3. Scenario C (W_CO with 2 owners) — invites cap at `admin`; NO owner promotion path exists (UI Members = "soon", no role API, DB read-only). Scenario C PARKED — asked Ely on BK-90 Jira comment (2026-10-08) whether to seed via DB or move out of scope.
4. Scenario 1 + B can share one leave (P1 leaves Shared) or re-invite P1 between them.

Setup observation (candidate finding): `POST /workspaces/{id}/projects` by a NON-member returned 422 `project_limit_reached` (workspace had 0/3 projects) — misleading error, expected 403/404.

## Repositories

- Backend: ../upex-bunkai-tms (Next.js + Supabase + Vercel, entry ../upex-bunkai-tms/.) — NOT cloned locally; read via `gh api` from `upex-galaxy/upex-bunkai-tms@staging` (36198b9)
- Frontend: same repo (Next.js)

## Code Locations

### Backend (upex-bunkai-tms)

- `app/api/v1/workspaces/[id]/membership/route.ts:22-59` — DELETE, cookie-only, cookie rotation
- `app/api/v1/workspaces/[id]/membership/response.ts:24-42` (error map), `:63-101` (BR-1 re-resolution, joined_at ASC)

### Frontend (upex-bunkai-tms)

- `app/(app)/settings/workspaces/page.tsx:19-119`
- `components/settings/WorkspacesList.tsx:116-143` (Leave / lock cell), `:174` (live region)
- `components/settings/LeaveWorkspaceModal.tsx:44-206` (testids: `leave-workspace-modal`, `leave-workspace-input`, `leave-workspace-confirm`, `leave-workspace-cancel`; row: `workspace-leave-{slug}`, `workspace-row-{slug}`, `workspace-active-{slug}`)
- `lib/account/leave-workspace.ts:8-10` (trimmed, case-sensitive match)

### Database (Supabase Postgres)

- `supabase/migrations/0044_leave_workspace.sql:49-113` — `bunkai_leave_workspace`; errcodes 42501 / P0002 / 45212 last_membership / 45213 sole_owner; PAT soft-revoke L101-105
- Tables: `workspace_members`, `workspaces`, `access_tokens`

## TMS Artifacts

| Type | ID | Name | Status |
|------|----|------|--------|
| ATP  | BK-90 `{{jira.acceptance_test_plan}}` field | Final ATP (Stage 1, 2026-10-08) — replaced 2026-08-05 shift-left draft | Written (REST PUT 204), synced to acceptance-test-plan.md |
| ATR  | BK-90 `{{jira.acceptance_test_results}}` field | - | Pending Stage 3 (untouched) |
| TC   | Outlines TC1-TC19 in ATP (no Jira `Test` items — jira-native, Stage 4 creates) | 17 in scope + TC18/TC19 BLOCKED (Scenario C) | Outlines only |

## Paths

- PBI: .context/PBI/epics/EPIC-BK-85-account-settings/stories/STORY-BK-90-tms-workspace-leave-a-workspace/
- Module Context: .context/PBI/epics/EPIC-BK-85-account-settings/module-context.md (MISSING — not generated)

## Stage Results

### Session Start

- Status: COMPLETED 2026-10-08. Next: Stage 1 (Planning).
- Readiness: READY (feature deployed to staging; ACs present; confirm mechanism de facto type-to-confirm in code).
- Open questions: (1) confirm mechanism formally open in AC field vs implemented type-to-confirm; (2) mockup "sole owner" badge absent in code; (3) extra staging accounts for personas.
- Drift flagged (details in context.md): label "Leave" vs "Leave workspace"; modal "next one on your list" vs BR-1 oldest joined_at; page fallback orders by created_at; Scenario C precondition needs 2+ memberships; API double-submit -> 404; PAT leave rejected (cookie-only).
- Missing inputs: master-test-plan.md, business-feature-map.md, business-api-map.md, module-context.md, local target repo clone, local mockup source.

### Planning

- Status: COMPLETED 2026-10-08 (Modality jira-native). Next: Stage 2 (Execution).
- Triage: veto REQUIRE TESTING (authz guards + data integrity on workspace_members / access_tokens); risk score 13 = HIGH -> Full ATP + extended edge cases. Shift-left short-circuit NOT applied (label >30 days).
- Outlines: 17 in scope (P0 7 / P1 6 / P2 4; Positive 5, Negative 6, Boundary 3, Edge 3) + 2 BLOCKED (TC18 co-owner leave, TC19 suspended-owner EC-1).
- Techniques: EP + BVA (TC6 type-to-confirm 8-row table; membership count 1 vs 2+), Decision Table R1-R7 (auth x member x count x role x other owners), State-Transition (leave active / non-active / dismiss / double-submit / re-invite), error-guessing charters.
- P0 set: TC1, TC2 (Scenario A), TC3, TC4 (Scenario 2), TC8 (leave active + BR-1 fallback), TC10 (content intact), TC11 (PAT revoke scoped).
- Execution order (in ATP section 8): A first (TC1/TC2, P2) -> P2 creates 2nd workspace -> TC3/TC4 -> P1 pre-leave TC5/6/7/12 -> P1 leaves Shared (TC8+TC10+TC11, then TC13 double-submit) -> P2 re-invites P1 (TC17) -> TC9+TC16 leaving non-active Shared. Never leave BK90 P1 Home.
- AC gaps: confirm mechanism still "open" in AC field (code = type-to-confirm, PO wording pending); "sole owner" badge in AC note vs absent in code; label "Leave" vs "Leave workspace"; modal "next one on your list" vs BR-1 joined_at; PAT-bearer rejection + double-submit 404 not in ACs; Scenario C precondition needs 2+ memberships.
- Data gap: member-role single-workspace persona not seeded (SMTP rate limit) — Scenario A covered by sole-owner representative (R4 precedence).
- Observation carried (not filed): non-member POST /workspaces/{id}/projects -> 422 project_limit_reached on 0/3 workspace.
- Sync note: jira:sync-issues renders underscores inside inline code as `*` in acceptance-test-plan.md (e.g. last*membership); Jira ADF itself holds the correct text.

### Execution

#### Transition Trail

| When | From | To | Transition ID | Notes |
|------|------|----|---------------|-------|

### Reporting

#### Transition Trail

| Scenario | From | To | Transition ID | Notes |
|----------|------|----|---------------|-------|

## Bugs Found

## Observations

- Concurrent co-owner leave race accepted by design (migration 0044 L44-48) — zero-owner workspace possible.
- Delete workspace button (BK-512, BLOCKED in Jira) is rendered for owners on `/settings/workspaces`.

## Checklist

### Session Start

- [x] Ticket + comments fetched (synced 2026-10-08 by orchestrator)
- [x] Project context loaded (partial — 3 of 4 project docs missing)
- [ ] Module context loaded or created (module-context.md missing, not generated)
- [x] Code explored (backend + frontend + migration)
- [x] Test data candidates identified (shapes only; DB not queried)
- [x] PBI folder + context.md + test-session-memory.md created
- [x] Story Explanation written
- [ ] Playwright config set (if UI test)

### Planning (Feature)

- [x] Triage completed (veto REQUIRE TESTING + risk score 13 HIGH)
- [x] Test data discovered (seeded via API at Session Start; DB not queried this stage)
- [x] ATP written to BK-90 story field (jira-native); ATR field pending Stage 3 (n/a: no separate ATP/ATR issues to link in jira-native)
- [x] Test Analysis filled in ATP
- [x] AC Gaps written
- [x] TC outlines in ATP (n/a: no Test work items in jira-native Stage 1)
- [x] Traceability verified (ATP field populated, sync readback matches)
- [ ] ATP marked complete; TCs transitioned to Ready (n/a until Stage 4)
