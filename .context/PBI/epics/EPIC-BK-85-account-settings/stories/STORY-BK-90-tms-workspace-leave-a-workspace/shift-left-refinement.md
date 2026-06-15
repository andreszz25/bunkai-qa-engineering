# BK-90 — Shift-Left Refinement (Acceptance Criteria Analysis)

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-06-10
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context

- **Primary persona affected**: Mateo Silva (QA Lead) — wants his account scoped only to the workspaces/teams he's actively working with, i.e. workspace-list hygiene.
- **Secondary personas (if any)**: Workspace owners/admins of the workspace Mateo leaves (their member roster shrinks by one) — no dedicated AC for their side, but relevant to the cascade question below.
- **Business value proposition**: Reduces clutter and confusion in the workspace switcher for users who accumulate memberships over time (consultants, cross-team QA leads); reinforces the multi-tenant model by making membership a two-way, user-controlled relationship (join via invite, leave via self-service).
- **KPI(s) influenced**: Workspace-switcher usability / account hygiene — no quantitative KPI named in the story.
- **User journey position**: Account & Settings area, "Workspaces" section — the same surface as sibling story BK-89 ("View the workspaces I belong to"). BK-90 is the destructive counterpart of BK-89's read-only list.

### Technical context

- **Frontend**: A "Workspaces" list/section (shared with BK-89) where each workspace row exposes a "Leave workspace" action, a confirmation dialog, and (for the sole-owner case) a disabled action + reason text.
- **Backend**: Per `business-data-map.md`, the operation is fundamentally a `DELETE` on the caller's own `workspace_members` row (`workspace_id`, `user_id` = `auth.uid()`), gated by the equivalent of `bunkai_is_workspace_owner(ws_id)` to block the sole-owner case. No REST endpoint for this currently exists in `api/openapi-types.ts` (empty stub) — this would be new surface (Server Action or new `/api/v1/workspaces/{id}/members/me` route, per the project's existing pattern of Server Actions + PostgREST).
- **External services**: None.
- **Integration points specific to this Story**: Active-workspace resolution (`active_workspace_id` / `bk_active_ws` cookie, per BK-86's refinement BR-2) — leaving the active workspace must trigger this resolution to re-run and pick a new active workspace.

### Story complexity

| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Medium | Sole-owner gate + active-workspace fallback are two independent rules that must both hold; ownership-transfer question (see SQ-2 below) could raise this to High pending PO answer. |
| Integration | Medium | Touches `workspace_members` (delete), `workspaces` (read for owner check), and active-workspace resolution (BK-86's BR-2 cookie/session logic). |
| Data validation | Low | The mutation itself is a single-row delete gated by a role/ownership check — no complex input validation. |
| UI | Low-Medium | One list action + one confirmation dialog + one disabled-state-with-reason; shared list surface with BK-89. |

**Estimated test effort**: Consistent with the story's existing 3 SP — this is a contained, well-scoped action once the multiple-owners and post-leave-cascade questions (SQ-2, SQ-3 below) are answered. If ownership transfer turns out to be in scope, effort would meaningfully increase (new UI flow + new business rule), which PO should weigh before finalizing the estimate.

### Epic-level inheritance (if applicable)

- **Risks restated at Story level**: Same multi-tenant/RLS risk surface as the rest of EPIC-BK-85 — any membership mutation must respect `bunkai_is_workspace_*` helper semantics (`business-data-map.md` §8) to avoid cross-tenant leakage or privilege bugs.
- **Integration points inherited**: Active-workspace resolution logic (BR-2, established in BK-86's refinement) is directly exercised here — BK-90 is the first story in this epic where that resolution logic must *re-run* as a side effect of another action, not just be read.
- **PO/Dev answers already given at epic level**: None yet specific to workspace membership mutations (BK-86 covered identity/role display + sign-out, a different surface).
- **Test strategy inherited**: None directly reusable; this is the first "destructive self-service membership" story in the epic.

### Feasibility note (accepted limitation)

This refinement is authored from `bunkai-qa-engineering` (the QA boilerplate repo), which has **no application code or synced API surface** for the target app (`upex-bunkai-tms`). `api/openapi-types.ts` is an empty 14-line stub — no workspace-membership endpoints are defined there. Feasibility below is assessed **only against the schema and RLS-helper description in `business-data-map.md`** (the `workspaces` / `workspace_members` tables, `owner_user_id`, `role`, `status`, and the `bunkai_is_workspace_owner` / `bunkai_is_workspace_admin` / `bunkai_is_workspace_member` helper functions). No grep against app code was performed — none exists in this repo. This mirrors the same accepted limitation noted in BK-86's prior refinement.

What the schema *does* support, per `business-data-map.md`:
- `workspace_members` is a join table (`workspace_id`, `user_id`, `role`, `status`, `joined_at`) — a "leave" operation maps cleanly to deleting the caller's own row, or to a status transition (the WorkspaceMember state machine in §4.2 currently only documents `invited → active ⇄ suspended`; "leave" / self-removal is **not** a state in that diagram — see SQ-1 below).
- `workspaces.owner_user_id` (FK) plus `bunkai_is_workspace_owner(ws_id)` (`status = 'active' AND role = 'owner'`) gives a structural basis for "is this user the sole owner of this workspace" — though "sole owner" requires counting rows where `role = 'owner'` for the workspace, which is a query the schema supports but isn't itself a named helper.

---

## Phase 2 — Story Quality Analysis

> Anchored on the 2 existing scenarios (`customfield_10063`). Per the assigned refinement, gaps below scrutinize state-machine, access-control, and data-integrity concerns — the three risk dimensions already flagged as the "veto reasons" for treating this as a full-refinement story.

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|--------------------------|
| SQ-1 | Scenario 1: "the active workspace falls back to **'Acme QA'**" | Is "Acme QA" a literal, hardcoded fallback target (a specific named workspace that always exists), or is it the *example* value used to illustrate a general fallback rule ("falls back to another workspace the user still belongs to")? If it's a rule, what is the selection order when the user belongs to multiple remaining workspaces (oldest membership? alphabetical? last-active)? | Determines whether the refined AC can be written generically (testable against any user/workspace combination) or must be pinned to one specific seeded workspace name. Also determines test-data setup: does the test fixture need to guarantee "Acme QA" exists, or just "at least one other workspace"? | Confirm "Acme QA" is illustrative, and state the fallback ordering rule (most likely candidate, consistent with BK-86's BR-2: same resolution `/api/v1/me` already uses for initial active-workspace selection — e.g. oldest membership by `joined_at`). |
| SQ-2 | Scenario 2: "Mateo is the **only owner** of 'Acme QA'" | Scenario 2 only covers the single-owner case. What happens when a workspace has **multiple owners** (`role = 'owner'` on 2+ `workspace_members` rows for the same workspace) and one of them leaves? Is "Leave workspace" available to a co-owner without further action, or does ownership need to be transferred/reduced first? | This is the most consequential gap in the story — it decides whether co-owner-leave is a simple "delete my row" (if multiple owners are allowed to leave freely) or requires a new "transfer ownership" sub-flow (a meaningfully larger feature). Without an answer, QA cannot design the multi-owner test outline at all. | Confirm: can a workspace have >1 `role = 'owner'` member (schema doesn't prevent it)? If yes, can any owner among 2+ leave freely (the "sole owner" check is purely a *count*, not an *identity* check)? This refinement assumes **yes** below (the gate is "are you the LAST remaining owner", not "are you AN owner") — flagged for confirmation as New Scenario C. |
| SQ-3 | Both scenarios — silent on **side effects on other workspace-scoped data** | When Mateo's `workspace_members` row for "Fintech Audit" is deleted, does anything else change for entities tied to that workspace where Mateo is the actor — e.g. `access_tokens` (PATs) with `workspace_id = 'Fintech Audit'` and `user_id = Mateo`, or `atcs`/`user_stories` he authored within that workspace? Per `business-data-map.md`, `atcs`/`user_stories`/etc. are scoped to `workspace_id` directly (not to the member row), so they should be unaffected/orphan-free regardless — but PATs reference both `user_id` AND `workspace_id` on the same row, and would become permanently inaccessible (Mateo can no longer authenticate into a workspace he's not a member of) without being formally revoked. | Determines whether "Leave workspace" needs to cascade-revoke the user's workspace-scoped PATs, or whether this is accepted as an out-of-band cleanup (orphaned-but-harmless token, since RLS would block its use anyway once membership is gone). Also confirms that authored content (ATCs, stories) is correctly NOT affected — a reassurance worth stating explicitly in the AC so QA doesn't waste time hunting for a cascade that shouldn't exist. | Confirm: (a) leaving a workspace does **not** delete or alter any `atcs`/`user_stories`/`modules`/`projects` Mateo authored there (they remain workspace-owned, attribution intact) — likely "yes, no change" and worth stating as an explicit non-cascade AC; (b) whether workspace-scoped PATs (`access_tokens.workspace_id` = the left workspace, `user_id` = Mateo) should be auto-revoked (`revoked_at` set) as part of the leave transaction, or left as-is (functionally dead but not formally revoked). |

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|--------------|------------------|
| 1 | AC | Neither scenario states what happens if Mateo belongs to **only one workspace** ("Fintech Audit") and leaves it — Scenario 1's fallback to "Acme QA" presumes a second workspace exists. | A scenario (or explicit AC clause) for the "leaving your last workspace" case — does it route the user back to `/onboarding` (per the onboarding flow in `business-data-map.md` Flow), or is "leave your only workspace" itself blocked (similar to the sole-owner block, but for "sole membership" rather than "sole ownership")? | Untestable edge case left undefined; if unhandled, a user could end up in a broken "no active workspace" state with no clear recovery path — directly contradicts the "account stays scoped to teams I actually work with" framing if "teams" becomes "zero teams" with no guided next step. |
| 2 | AC | Confirmation dialog UX is described only as "names the workspace explicitly" — no mention of whether the user must **type the workspace name** to confirm (a common destructive-action pattern for actions with no undo) vs. a single confirm/cancel button pair. | Either an explicit statement that a simple confirm dialog (naming the workspace) is sufficient, or a refined AC describing a type-to-confirm step. | Materially changes the Phase 4 outline for the "confirmation" scenario (1 happy-path click vs. a multi-step type-and-match interaction with its own validation/typo edge cases) — low business risk but real test-design impact, so flagged here rather than padded into "Critical Questions". |

### Edge cases not in Story

(Captured in Phase 5 below, per the outline-only adaptation for shift-left.)

### Contradictions

No contradictions found. The two scenarios are complementary (one covers the "can leave" happy path, the other the "cannot leave" gate) and do not conflict with each other or with the sibling BK-89 story.

### Testability validation

**Verdict: Yes, with refinement.** Both existing scenarios are concrete and largely assertable as written — Scenario 2 in particular is already clean and needs only data-driven generalization. Scenario 1 needs the "Acme QA" fallback language clarified (SQ-1) before a deterministic, non-hardcoded assertion can be written, but this is a wording tightening, not a structural blocker. The genuinely open item is SQ-2 (multiple owners) — without an answer, the multi-owner test outline cannot be designed, but this does not block testing the two *existing* scenarios as refined below.

---

## Phase 3 — Refined Acceptance Criteria

### Existing Scenarios — Refinements

> Refinements of the 2 approved scenarios sharpen wording for testability; they carry no inference flag. New scenarios for genuine gaps (SQ-2, SQ-3, Gap #1) are flagged **NEEDS PO/DEV CONFIRMATION** below.

#### Scenario 1 — Leaving a workspace asks for confirmation

**Before:**
```gherkin
Scenario: Leaving a workspace asks for confirmation
  Given Mateo is viewing "Fintech Audit" in the Workspaces section
   When he selects "Leave workspace"
   Then a confirmation names "Fintech Audit" explicitly before he commits
    And on confirm the workspace disappears from his list
    And the active workspace falls back to "Acme QA"
```

**After** (resolves SQ-1 — generalizes the fallback rule, keeping "Acme QA" as the illustrative example consistent with the original):

```gherkin
Scenario: Leaving a workspace asks for confirmation
  Given Mateo Silva belongs to two workspaces — "Fintech Audit" (active)
        and "Acme QA" — and is viewing "Fintech Audit" in the
        Workspaces section
   When he selects "Leave workspace"
   Then a confirmation dialog names "Fintech Audit" explicitly
        before he commits
    And on confirm, his membership row for "Fintech Audit" is removed
        and the workspace disappears from his Workspaces list
    And the active workspace falls back to "Acme QA"
        (his other remaining workspace, selected per the same
        active-workspace resolution rule used elsewhere — see BR-1)
    And the workspace switcher / global chrome now reflects "Acme QA"
        as active
```

*Rationale*: keeps "Fintech Audit" / "Acme QA" exactly as named in the original (no invented names), but makes explicit that "Acme QA" is the user's *other remaining workspace* rather than a hardcoded global fallback — pins the fallback to a named, reusable rule (BR-1, below) so the assertion is deterministic regardless of which two workspaces a test user happens to have.

#### Scenario 2 — A user cannot leave a workspace they solely own

**Before:**
```gherkin
Scenario: A user cannot leave a workspace they solely own
  Given Mateo is the only owner of "Acme QA"
   When he views that workspace in the Workspaces section
   Then the "Leave workspace" action is unavailable
    And he sees the reason (he is the sole owner)
```

**After** — minor tightening only (adds the explicit "no other owner" framing and a concrete reason-text expectation placeholder); the scenario was already concrete and testable as written:

```gherkin
Scenario: A user cannot leave a workspace they solely own
  Given Mateo Silva is a member of "Acme QA" with role "owner"
    And no other "Acme QA" member has role "owner"
   When he views "Acme QA" in the Workspaces section
   Then the "Leave workspace" action is unavailable (disabled or hidden)
    And he sees an explanatory message indicating he is the sole owner
        and must transfer or share ownership before leaving
```

*Rationale*: "the only owner" is restated as "no other member has role owner" — same meaning, but phrased as a count-based condition that maps directly onto a testable query (`COUNT(*) WHERE workspace_id = X AND role = 'owner'`), and sets up the contrast with New Scenario C (multi-owner case) below. The reason-text wording ("transfer or share ownership") is QA's best-guess phrasing pending Dev's actual copy — flagged inline as non-binding illustrative text, not a new requirement.

---

### New Scenarios — Gaps Filled

#### New Scenario A — Leaving the user's only workspace

```gherkin
Scenario: Leaving the only workspace a user belongs to
  Given Mateo Silva belongs to exactly one workspace, "Fintech Audit"
        (role "member", not sole owner — e.g. another member holds
        role "owner")
   When he selects "Leave workspace" on "Fintech Audit" and confirms
   Then his membership row for "Fintech Audit" is removed
    And he has no remaining workspace memberships
    And he is routed to the onboarding flow (the same entry point a
        brand-new user without any workspace lands on)
```
**NEEDS PO/DEV CONFIRMATION** — neither scenario addresses what happens when the workspace being left is the user's ONLY one (Scenario 1's fallback to "Acme QA" presumes a second workspace exists). This scenario proposes routing to `/onboarding` (the existing no-workspace landing per `business-data-map.md`'s onboarding flow) as the most consistent behavior with the rest of the app, but needs PO confirmation — an alternative the team may prefer is to **block** "leave" when it is the user's last workspace, the same way Scenario 2 blocks sole-owner leaves (i.e., a user must always belong to at least one workspace).

#### New Scenario B — No cascading effect on workspace-owned content

```gherkin
Scenario: Leaving a workspace does not affect content the user authored there
  Given Mateo Silva authored several ATCs and user stories within
        "Fintech Audit" before leaving
   When he leaves "Fintech Audit"
   Then those ATCs, user stories, modules, and projects remain
        unchanged and fully intact within "Fintech Audit"
    And Mateo can no longer view or access them (he is no longer a
        member of that workspace)
```
**NEEDS PO/DEV CONFIRMATION** — neither scenario states this explicitly, but per `business-data-map.md`'s entity model, `atcs`/`user_stories`/`modules`/`projects` are scoped to `workspace_id` directly (not to the `workspace_members` row), so this should hold true with zero additional implementation. This scenario is included as a **non-cascade guarantee** — QA's expectation of "no side effects" — and is flagged for confirmation mainly so the team agrees it's worth an explicit regression check (e.g. a workspace's ATC count is unchanged after a member leaves) rather than something QA assumes and never verifies.

#### New Scenario C — A co-owner can leave when other owners remain

```gherkin
Scenario: A co-owner can leave a workspace that has other owners
  Given "Acme QA" has two members with role "owner" — Mateo Silva
        and a second user, Lena Ortiz
   When Mateo views "Acme QA" in the Workspaces section
   Then the "Leave workspace" action IS available to him
    And selecting it follows the same confirmation flow as Scenario 1
    And on confirm, "Acme QA" still has Lena Ortiz as its remaining
        owner with full ownership privileges unchanged
```
**NEEDS PO/DEV CONFIRMATION** — this is the central gap identified in SQ-2. Scenario 2 only describes the SOLE-owner block; it does not say whether the gate is "you are AN owner" (which would also block this case) or "you are the LAST owner" (which would not). This scenario assumes the latter (a count-based "last owner" gate, consistent with how `bunkai_is_workspace_owner` style checks are typically implemented) — but if the team intends NO co-owner to ever leave without an explicit ownership-transfer step first, this scenario is invalid and a "transfer ownership" sub-flow becomes a new requirement with its own AC, materially changing the story's scope and size.

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate

| Type | Count | Notes |
|------|-------|-------|
| Positive | 3 | Outlines 1, 2, 5 — confirmation + fallback flow, co-owner leave, non-cascade content check |
| Negative | 1 | Outline 3 — sole-owner block with reason |
| Boundary | 1 | Outline 4 — leaving the only workspace |
| Integration | 1 | Outline 6 — active-workspace resolution re-run after leave |
| **Total** | **6** | Lean count — story is a single, well-bounded action; the multi-owner question (SQ-2) is the one item that could add a 7th outline ("transfer ownership before leave") if the team chooses the stricter gate. |

**Rationale**: The story is a single user action (leave workspace) with two structurally distinct gates (sole-owner block, active-workspace fallback) and one open multi-owner question. 6 outlines covers both refined existing scenarios, both confirmed new scenarios (A, B), the multi-owner case (C, pending confirmation), and a dedicated check on the active-workspace resolution side effect — proportionate to the story's existing 3 SP estimate.

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive

- **Should show a confirmation naming the workspace, then remove membership and fall back to the user's other workspace as active** — Pre: Mateo belongs to "Fintech Audit" (active) and "Acme QA". Expected: confirm dialog names "Fintech Audit"; on confirm, "Fintech Audit" disappears from list and "Acme QA" becomes active. (Scenario 1, refined)
- **Should allow a co-owner to leave a workspace that retains another owner** — Pre: "Acme QA" has 2 members with role "owner" (Mateo + Lena). Expected: "Leave workspace" is available to Mateo; after leaving, "Acme QA" remains intact with Lena as owner. (New Scenario C — **NEEDS PO/DEV CONFIRMATION**)
- **Should leave content authored in the left workspace fully intact and inaccessible to the leaving user** — Pre: Mateo authored ATCs/stories in "Fintech Audit" before leaving. Expected: ATC/story counts in "Fintech Audit" unchanged; Mateo can no longer view them. (New Scenario B — **NEEDS PO/DEV CONFIRMATION**)

#### Negative

- **Should block "Leave workspace" for the sole owner and show the reason** — Pre: Mateo is the only `role = 'owner'` member of "Acme QA". Expected: action unavailable/disabled; explanatory sole-owner message shown. (Scenario 2, refined)

#### Boundary

- **Should handle leaving the user's only remaining workspace** — Pre: Mateo belongs to exactly one workspace, "Fintech Audit" (not sole owner). Expected: per PO answer — either routed to onboarding with zero memberships, or "Leave workspace" blocked as a last-membership guard. (New Scenario A — **NEEDS PO/DEV CONFIRMATION**)

#### Integration

- **Should re-resolve the active workspace immediately after leaving, consistent with BK-86's active-workspace resolution rule** — Pre: Mateo's active workspace is the one being left. Expected: post-leave, `active_workspace_id` / `bk_active_ws` resolves to the remaining workspace per the same ordering rule used at sign-in (BR-1), and the global chrome (account affordance / workspace switcher from BK-86/BK-89) reflects it immediately without requiring a manual refresh.

> **NOT included here** (deferred to in-sprint planning by `/sprint-testing` Stage 1): parametrization tables, per-outline test-data JSON, numbered test steps, Faker generation strategies.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality |
|---|-----------|---------------------|--------------|
| EC-1 | Leave workspace as the last *active member* but not the owner (e.g. the owner row has `status = 'suspended'`, leaving Mateo as the only `active` member while an inactive owner row still exists) — does the sole-owner check consider `status`, or only `role`? | No | Medium |
| EC-2 | Leave a workspace while having open/assigned work (ATCs in `running`/`blocked` status authored or "owned" by Mateo, if any per-ATC ownership concept exists) — does leaving surface a warning, or is it silent (consistent with New Scenario B's "no cascade" answer)? | No | Low |
| EC-3 | Concurrent action: Mateo leaves "Fintech Audit" in one tab while an admin simultaneously promotes him to `role = 'owner'` in another tab/session — race between the leave-confirmation gate check and the role change | No | Medium |
| EC-4 | Re-invitation after leaving — can Mateo be re-invited to "Fintech Audit" by an admin afterward, and does his prior `joined_at` / history reset? | No | Low |
| EC-5 | Confirmation dialog dismissed (Cancel / Escape / click-outside) — workspace remains in the list, no membership change, no active-workspace change | No | Low |
| EC-6 | Double-submit of "Leave workspace" confirm (rapid double-click) — duplicate delete attempts on an already-removed `workspace_members` row; should be a clean no-op / idempotent, not an error | No | Low |
| EC-7 | Leaving the workspace that is currently active vs. leaving a NON-active workspace — Scenario 1 only describes leaving the active one; leaving a background workspace should NOT change the active workspace at all | No | Medium |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- The two existing scenarios are well-written and concrete for the cases they cover (confirmation + fallback; sole-owner block) and need only light wording tightening (SQ-1) — they are NOT the problem.
- The real gap is **scope**: the story silently assumes (a) the user always has a second workspace to fall back to, and (b) "sole owner" is the only ownership configuration that matters. Both assumptions break under realistic multi-workspace, multi-owner usage that this same epic's personas (QA Leads working across client engagements) are likely to hit.
- SQ-2 (multiple owners) is the single highest-leverage question — its answer determines whether this remains a 3 SP "delete my membership row" story or grows to include an ownership-transfer sub-flow.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **Can a workspace have more than one member with `role = 'owner'`, and if so, can any of them leave freely as long as at least one owner remains — or must ownership be transferred/reduced to exactly one other owner first?**
   - **Context**: Scenario 2 only describes the single-owner block ("Mateo is the only owner of Acme QA"). It does not say what happens for a workspace with 2+ owners.
   - **Impact if unanswered**: New Scenario C (co-owner leave) cannot be designed or estimated; if the answer requires an ownership-transfer flow, this is new UI + new business rule not currently scoped at all, which would change the story's size materially.
   - **Suggested answer (if you have one)**: This refinement assumes the gate is "are you the LAST remaining owner" (count-based), allowing any co-owner to leave freely while 1+ owners remain — the schema (`workspace_members.role`) does not prevent multiple `owner` rows per workspace, so this is the lower-effort interpretation.

2. **What happens when a user leaves the only workspace they belong to** — is "leave" blocked in this case (an additional "must belong to at least one workspace" guard, symmetric to the sole-owner guard), or does the user land on the onboarding/no-workspace flow?
   - **Context**: Scenario 1's "active workspace falls back to Acme QA" presumes a second workspace exists; neither scenario covers the single-workspace case.
   - **Impact if unanswered**: New Scenario A (boundary outline) cannot be finalized — QA would need to test two structurally different behaviors (a block vs. a redirect) depending on the answer, and an incorrect guess risks shipping a state where a user has zero workspaces with no recovery path.
   - **Suggested answer (if you have one)**: Routing to `/onboarding` (the existing no-workspace entry point, per `business-data-map.md`) is the lower-effort option since it reuses an existing flow; blocking "leave" in this case adds a second gate condition alongside the sole-owner gate.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **Should workspace-scoped Personal Access Tokens (`access_tokens` rows where `workspace_id` = the left workspace and `user_id` = the leaving user) be auto-revoked (`revoked_at` set) as part of the "leave workspace" transaction, or left as functionally-dead-but-not-formally-revoked rows?** — Context: per `business-data-map.md`, PATs carry both `user_id` and `workspace_id`; once membership is removed, RLS would block the token's use regardless, but the token row itself remains "active" in audit terms unless explicitly revoked. Testing impact: determines whether QA needs a PAT-revocation assertion as part of the leave-workspace test, or whether this is explicitly out of scope (a one-line non-goal in the AC would resolve this without further discussion).

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|----------------|--------------------|---------|
| 1 | Scenario 1: "the active workspace falls back to 'Acme QA'" | Reword to: "the active workspace falls back to another workspace the user belongs to (selected per the standard active-workspace resolution rule), illustrated here as 'Acme QA'" | Decouples the AC from one hardcoded example name, making it directly assertable against any seeded test-user/workspace pair. |
| 2 | Scenario 2: "Mateo is the only owner of 'Acme QA'" | Reword to: "no other member of 'Acme QA' has role 'owner'" | Frames the gate as a count-based condition that maps 1:1 to a testable query and sets up a clean contrast with the multi-owner case (New Scenario C). |

---

## Data feasibility flags

No data feasibility risks identified beyond the accepted cross-repo limitation noted in Phase 1 (no synced API surface / app code in `bunkai-qa-engineering` for `upex-bunkai-tms`; feasibility assessed against `business-data-map.md`'s schema description only).

---

## Recommended testing strategy

### Pre-implementation
- PO/Dev resolve Critical Questions 1 and 2 (multi-owner gate semantics, single-workspace-leave behavior) before sprint estimation — both directly affect the outline count and potentially the story's scope.
- Dev confirms the Technical Question (PAT cascade) so the "no cascade" non-goal (New Scenario B) can be stated explicitly in the final AC.

### During implementation
- QA monitors whether the "leave workspace" mutation is implemented as a Server Action (consistent with the rest of the app per `business-data-map.md` §"current API surface is intentionally minimal") or a new REST endpoint — affects whether `/sprint-testing` Stage 1 needs an API-layer outline in addition to UI.

### Post-implementation (in-sprint by /sprint-testing)
- Execute the 6 Phase-4 outlines above (expanded with parametrization/test-data per `/sprint-testing` Stage 1 conventions).
- Re-validate New Scenarios A/B/C against the PO's actual answers — the Gherkin text above is QA's best-guess phrasing and may need adjustment once confirmed.

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-------------------------------|
| 1 | Active-workspace fallback resolves incorrectly (e.g. resolves to a workspace the user no longer belongs to, or leaves `active_workspace_id` null) after leaving the active workspace | Medium | High | Outlines 1, 6 |
| 2 | Sole-owner gate is implemented as "are you AN owner" instead of "are you the LAST owner", incorrectly blocking valid co-owner leaves | Medium | Medium | Outline 2 (pending SQ-2 confirmation) |
| 3 | User ends up with zero workspace memberships and no recovery path after leaving their only workspace | Low | High | Outline 4 (pending Critical Question 2) |
| 4 | Leaving cascades unintentionally into authored content (ATCs/stories) becoming orphaned or deleted | Low | High | Outline 5 |

---

## Next steps

- [ ] PO answers Critical Questions 1 and 2 before sprint planning
- [ ] Dev answers the Technical Question (PAT cascade) before estimation
- [ ] Story enters sprint at `Ready For Dev` once estimated
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and expand the 6 outlines above with parametrization, test data, and numbered steps
