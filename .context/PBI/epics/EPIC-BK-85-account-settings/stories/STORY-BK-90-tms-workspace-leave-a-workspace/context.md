# BK-90: TMS-Workspace | Leave a workspace

**Ticket:** BK-90 | **Epic/Module:** EPIC-BK-85-account-settings | **Status:** Ready For QA | **Sprint:** n/a (not in synced fields) | **Story Points:** 5

> Jira-sourced detail (read-only caches, not copied here): `story.md`, `acceptance-criteria.md`, `acceptance-test-plan.md`, `comments.md`, `scope.md`, `out-of-scope.md`, `implementation-plan.md` — materialized by `bun run jira:sync-issues get BK-90 --include-comments` (synced 2026-10-08). `shift-left-refinement.md` is the local shift-left working copy (2026-06-10).

## Team Discussion (analysis only — source is comments.md)

### Key Decisions

- [Andrés Cumare] (2026-06-10): Shift-left refinement — 2 scenarios sharpened, 3 new (A/B/C) added, 3 open questions raised (multi-owner gate, only-workspace leave, PAT revoke).
- [Andrés Cumare] (2026-06-10): Role-played PO/Dev/Design answers (explicitly disclaimed, NOT real confirmations): count-based owner gate; only-workspace -> `/onboarding`; PAT auto-revoke; simple confirm/cancel dialog.
- [Ely] (2026-07-30): Mockup posted — `settings-workspaces.html` / `.png` (attachment 10199), spec `master-design-plan §4.10`. [image attachment: settings-workspaces.png]
- [Ely] (2026-07-31 16:07): PO ratification of the 3 shift-left questions as role-played (count-based gate, `/onboarding`, PAT auto-revoke).
- [Ely] (2026-07-31 16:11): CORRECTION — the shipped mockup takes precedence where it speaks: (1) only-workspace leave is BLOCKED (action does not render), not redirected; (2) confirmation is TYPE-TO-CONFIRM (type exact workspace name to enable Leave). Gate + PAT decisions stand.
- [Ely] (2026-07-31 17:45): Dev complete — PR #72 (backend RPC + `DELETE /api/v1/workspaces/{id}/membership`) and PR #74 (type-to-confirm modal + list wiring) merged to `staging`. Spec Compliance Matrix in target repo `review.md`.
- [Andrés Cumare] (2026-08-05): AC + ATP reconciled (Scenario A -> block, PAT clause into Scenario B). Kept ONE question open: confirm-dialog mechanism (simple vs type-to-confirm), "no design-authoritative answer".

### Technical Notes

- [Ely] (2026-07-31): RPC `bunkai_leave_workspace`; PAT revoke = `UPDATE access_tokens SET revoked_at = now() WHERE user_id = auth.uid() AND workspace_id = <ws> AND revoked_at IS NULL`, same transaction as membership delete.
- [Andrés Cumare] (2026-08-05): `.agents/jira-fields.json` AC field id corrected `customfield_10063` -> `customfield_10097`.

### Edge Cases Raised

- Shift-left EC-1..EC-7 (`shift-left-refinement.md` Phase 5): suspended owner row, open work on leave, leave/promote race, re-invite, dismiss (Cancel/Esc/click-outside), double-submit, leaving a NON-active workspace.

## Ratified-decision table

| Behavior | Source | Status |
|---|---|---|
| Owner gate is count-based ("last remaining active owner"), co-owner may leave | PO ratification 2026-07-31 + Impl Plan Decision 1 | RATIFIED (mockup silent) |
| Sole owner: Leave unavailable, "Can't leave" + "You're its only owner. Ownership transfer isn't available yet." | AC Scenario 2 + mockup | RATIFIED + MOCKUP-DRIVEN |
| Only workspace: Leave does NOT render (block, not `/onboarding`) | Ely correction 2026-07-31 (mockup `state:single-workspace`) + AC 2026-08-05 | MOCKUP-DRIVEN (supersedes PO ratification) |
| Workspace-scoped PATs auto-revoked in same transaction | PO/Dev ratification 2026-07-31 + AC Scenario B | RATIFIED (mockup silent) |
| Authored content (ATCs, stories, modules, projects) untouched on leave | AC Scenario B | RATIFIED |
| Confirm names the workspace explicitly | AC Scenario 1 + Scope | RATIFIED |
| Confirm mechanism = type-to-confirm (exact, case-sensitive name) | Ely correction 2026-07-31 + Impl Plan Decision 4 + shipped code | MOCKUP-DRIVEN + IMPLEMENTED — but AC field (2026-08-05) still lists it as OPEN |
| Active workspace falls back to remaining one (BR-1, oldest membership) and chrome reflects it | AC Scenario 1 + Integration outline | RATIFIED |
| Ownership transfer; workspace delete/archive | out-of-scope.md | OUT OF SCOPE |
| Server-side enforcement of guards | scope.md | RATIFIED |

## Related Code (target repo `upex-galaxy/upex-bunkai-tms`, branch `staging` @ `36198b9`, read via GitHub API — not cloned locally)

### Database

- `supabase/migrations/0044_leave_workspace.sql:49-107` — `bunkai_leave_workspace(p_workspace_id)` SECURITY DEFINER. Guard order: `not_authenticated` 42501 (L61-63) -> `not_a_member` P0002 (L71-73) -> `last_membership` 45212 when caller has <=1 active membership (L75-82) -> `sole_owner` 45213 when role=owner and 0 OTHER active owners (L84-95). Then DELETE membership row (L97-99) + soft-revoke PATs scoped to that workspace (L101-105). Grants: `authenticated` only (L112-113).
- L44-48: concurrent co-owner leave race ACCEPTED (no `FOR UPDATE`) — two co-owners could leave simultaneously and leave zero owners.
- Tables: `workspace_members`, `workspaces`, `access_tokens`.

### Backend

- `app/api/v1/workspaces/[id]/membership/route.ts:22-59` — `DELETE`; non-UUID -> `bad_request` (L26-28); `auth: 'cookie-only'` (L59) -> PAT bearer callers rejected ("Personal access tokens cannot leave a workspace. Use a browser session."). Re-resolves + rotates `bk_active_ws` cookie only if the left workspace was active (L35-53). Response body `{ newActiveWorkspaceId, newActiveWorkspaceName }`.
- `app/api/v1/workspaces/[id]/membership/response.ts:24-42` — error map: 42501->401 `unauthorized`, P0002->404 `not_found`, 45212->409 `conflict` "You cannot leave your only workspace." (`details.reason=last_membership`), 45213->409 `conflict` "You are the only owner of this workspace. Transfer ownership before leaving." (`details.reason=sole_owner`).
- `.../response.ts:63-101` — fallback = remaining active memberships ordered by `joined_at` ASC (BR-1); short-circuits (no change) when left workspace was not active (EC-7).

### Frontend

- `app/(app)/settings/workspaces/page.tsx:19-119` — `/settings/workspaces`; owner-count query via admin client (L93) feeds `isSoleOwner`; passes `enableLeaveAction` (L114). Page-level active resolution orders workspaces by `created_at` (L28-36).
- `components/settings/WorkspacesList.tsx:116-143` — Leave cell rendered only when `workspaces.length > 1` (L118); sole owner -> "Can't leave" + lock copy (L119-129); else ghost button labeled "Leave", `data-testid="workspace-leave-{slug}"` (L132-141). Live region `workspaces-live-region` (L174). Delete button (BK-512) also rendered for owners (L147-163).
- `components/settings/LeaveWorkspaceModal.tsx:44-206` — `role="alertdialog"`, `data-testid="leave-workspace-modal"`; copy names workspace name + slug (L141-149); active-workspace note (L151-155); type-to-confirm input `leave-workspace-input` (L158-170); confirm `leave-workspace-confirm` disabled until match (L174-191); cancel `leave-workspace-cancel`; focus moved to input on open (L65-69); double-submit guard (L78); stays open + toast on error (L104-112); success message "You left {name}. {new} is now your active workspace." + `router.refresh()` (L90-100).
- `lib/account/leave-workspace.ts:8-10` — `isLeaveConfirmEnabled = typed.trim() === workspaceName` (typed value trimmed, case-sensitive).
- `lib/account/workspaces.ts:91` — `isSoleOwner = role === 'owner' && ownerCount === 1` (active owners only).

### Dev review (`review.md`)

- Untracked from target repo git by commit `97e8f17` ("untrack the .context/PBI Jira cache"); retrieved from PR #74 merge commit `547bc2f`. Spec Compliance Matrix marks all 5 scenarios `covered`; Scenario B content non-cascade = "no code needed"; PAT scope = `manual:migration-review`; frontend coverage mostly `review-approved` (no UI/E2E tests). Route cookie-rotation branch has no direct test (PR1 finding #2, dismissed).

## Spec vs code drift / observations (to verify in Stage 2)

1. AC field keeps confirm mechanism "open" and mechanism-agnostic, but mockup-precedence comment + Impl Plan Decision 4 + shipped code all = type-to-confirm. Practical status: de facto resolved; AC text lags.
2. AC Scenario 2 note cites a "sole owner" badge in the mockup; code renders only the "Can't leave" lock note (no badge found in `WorkspacesList.tsx`).
3. Action label is "Leave" (aria-label "Leave workspace {name} ({slug})"), AC wording says "Leave workspace".
4. Modal copy says "the next one on your list becomes active"; server rule is oldest `joined_at` membership (list is also `joined_at` ASC, so "first remaining", not "next"). Page-level fallback (no/invalid cookie) uses `workspaces.created_at` order — a different ordering than BR-1 `joined_at`.
5. New Scenario C precondition omits that the co-owner must belong to 2+ workspaces; otherwise `last_membership` (checked BEFORE `sole_owner`) blocks the leave.
6. Double-submit (EC-6) at API level returns 404 `not_found` (not an idempotent no-op); UI guard prevents it.
7. EC-1 answered by code: only `status='active'` owners count; a non-owner can always leave (if 2+ memberships), even when that leaves a workspace with no active members.
8. Sole owner whose ONLY workspace is that one sees neither Leave nor the lock note (whole cell gated by `length > 1`); Delete (BK-512, BLOCKED in Jira) button is visible on staging.
9. `auth: 'cookie-only'` came from a later refactor (BK-499) — leave via PAT must be rejected; confirm status code in Stage 2.
10. Concurrent co-owner leave race accepted (migration L44-48) — zero-owner workspace possible; exploratory only.

## Test Data Needs (do NOT query DB at Session Start — discover in Stage 1 via `[DB_TOOL]` on `staging-dbhub`)

| Persona | Shape needed | Covers |
|---|---|---|
| P1 member, multi-ws | `workspace_members` active, role member/admin in >=2 workspaces; active cookie on the one to leave | Scenario 1, Integration, EC-5, EC-7 (leave non-active) |
| P2 sole owner | active owner of W_A with no other active owner row; plus >=1 other active membership | Scenario 2 (UI lock + API 409 `sole_owner`) |
| P3 single-ws | exactly 1 active membership (member role; variant: owner) | New Scenario A (no Leave render; API 409 `last_membership`) |
| P4 co-owner | W_C with 2 active owners (P4 + another user); P4 also in >=1 other workspace | New Scenario C |
| P5 PAT holder | active `access_tokens` row with `workspace_id = W_B` + control token for another workspace; authored ATCs/stories in W_B | New Scenario B (revoked_at set only for W_B token; content counts unchanged) |

- Only one staging account in `.env` (`STAGING_USER_EMAIL` / `STAGING_USER_PASSWORD`). Multi-persona + co-owner setups need extra accounts or invites — test-data gap for Stage 1.
- Leave is destructive (membership row DELETED); each run consumes setup. Restore path = re-invite (EC-4) or DB re-seed.

## TMS Artifacts

| Artifact | ID | Status |
|---|---|---|
| ATP | Pending | Created in Stage 1 (Xray Test Plan, jira-xray modality) |
| ATR | Pending | Created in Stage 3 (Xray Test Execution) |
| Linked | BK-858 "[Sprint-Testing] TMS-Workspace \| Leave a workspace" (Backlog) | Existing related story — check in Stage 1 |

## Open questions

1. Confirm-dialog mechanism: the 2026-08-05 QA comment keeps it open, yet the 2026-07-31 mockup-precedence correction, Impl Plan Decision 4, and shipped code all = type-to-confirm. Recommend: accept type-to-confirm (mockup-driven) as the tested behavior and close the question, or get an explicit Design/PO ack. Non-blocking for testing what shipped.
2. "Sole owner" badge: mockup per AC note vs. no badge in code — confirm whether badge is required (possible minor UI defect).
3. Test accounts: which additional staging accounts may be used/created for P2-P5 personas?

## Missing inputs

- `.context/master-test-plan.md` — missing.
- `.context/business/business-feature-map.md` — missing.
- `.context/business/business-api-map.md` — missing.
- `.context/PBI/epics/EPIC-BK-85-account-settings/module-context.md` — missing; not generated in this session.
- Target repo not cloned at `/home/andreszz25/upex-bunkai-tms` (path from `.agents/project.yaml`); code read read-only via `gh api` from public `upex-galaxy/upex-bunkai-tms@staging`.
- Mockup source (`.context/designs/.../settings-workspaces.html`) not present locally.

## Session Notes

### Session 1 — 2026-10-08

- Context loaded: synced PBI files, project.yaml, business-data-map, domain-glossary (partial).
- Code explored: PR #72 / #74 files on `staging` @ `36198b9` + `review.md` @ `547bc2f`.
- Environment: staging (`https://staging-upexbunkai.vercel.app`), reachability verified by orchestrator. No override.
- TMS modality: jira-xray.
