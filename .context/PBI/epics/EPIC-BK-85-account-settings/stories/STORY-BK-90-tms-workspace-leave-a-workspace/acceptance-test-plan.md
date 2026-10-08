# BK-90 — Acceptance Test Plan (QA)

> Jira field: `customfield_10137` · [View in Jira](https://jira.upexgalaxy.com/browse/BK-90)

## Acceptance Test Plan (ATP) — BK-90 Leave a workspace

> ***INFO:*** Stage 1 final ATP — 2026-10-08. Supersedes the 2026-08-05 shift-left ATP DRAFT (6 outlines). TMS modality: jira-native — this field is the ATP; TC outlines only (Test work items are created in Stage 4 for regression-worthy cases). Environment: staging.

### 1. Triage

| Item | Result |
| --- | --- |
| Veto | REQUIRE TESTING — authorization (membership guards, PAT bearer rejection) + data integrity on core entities (`workspace*members` delete, `access*tokens` revoke) |
| Risk score | 13 / HIGH — new feature +3, dynamic data +3, explicit ACs +2, user-facing +2, high effort (5 SP) +2, multi-component (UI + API + DB RPC) +1 |
| Decision | Full ATP + extended edge cases |
| Shift-left short-circuit | Not applied — label shift-left-2026-06-10 is older than 30 days; refinement reused as input only |

### 2. Risk analysis (impact x likelihood)

| Risk | Impact | Likelihood | Priority | Covered by |
| --- | --- | --- | --- | --- |
| Guard bypass strands a workspace (sole owner leaves) or an account (last membership) | High | Medium | P0 | TC3, TC4, TC1, TC2 |
| Leave deletes or hides authored content (cascade) | High | Low | P0 | TC10 |
| PAT revoke hits the wrong workspace, or misses the left one | High | Medium | P0 | TC11 |
| Active workspace not re-resolved (stale cookie, broken chrome) | High | Medium | P0 | TC8, TC9 |
| Leave via PAT bearer / unauthenticated / non-member reaches the RPC | Medium | Low | P1 | TC12, TC13, TC14 |
| Type-to-confirm matching wrong (case, whitespace, partial) | Medium | Medium | P1 | TC6 |
| Dismiss, double-submit, malformed id, re-invite | Low | Medium | P2 | TC7, TC15, TC16, TC17 |

### 3. Refined acceptance criteria (as tested against shipped code)

- ***Scenario 1*** — Leave asks for confirmation naming the workspace (name + slug). Mechanism = type-to-confirm: Leave button enabled only when the typed value, trimmed, equals the workspace name exactly (case-sensitive). On confirm the `workspace*members` row is deleted, the row disappears from /settings/workspaces, the active workspace falls back to the oldest remaining membership (`joined*at` ASC, BR-1), and the switcher/chrome shows it. Success copy: "You left X. Y is now your active workspace."
- ***Scenario 2*** — Sole active owner with 2+ memberships sees "Can't leave" + "You're its only owner. Ownership transfer isn't available yet." instead of Leave. API: 409 conflict, details.reason = `sole_owner`.
- ***Scenario A*** — User with exactly 1 active membership: the Leave cell does not render, no dialog reachable. API: 409 conflict, details.reason = `last*membership` (checked BEFORE `sole*owner`).
- ***Scenario B*** — Authored projects/modules/stories/ACs/ATCs unchanged; leaver loses access; the leaver's PATs with `workspace*id` = left workspace get `revoked*at` set in the same transaction; other PATs untouched.
- ***Scenario C*** — Co-owner can leave while another active owner remains. BLOCKED (see section 7).

### 4. Decision table — leave guards (server order, migration 0044)

| Rule | Authenticated (cookie) | Member | Active memberships | Role | Other active owners | Expected | TC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | No | - | - | - | - | 401 unauthorized | TC14 |
| R2 | PAT bearer | - | - | - | - | rejected (cookie-only), no change | TC12 |
| R3 | Yes | No | - | - | - | 404 `not_found` | TC13 |
| R4 | Yes | Yes | 1 | any (incl. sole owner) | - | 409 `last_membership`; UI: no Leave cell | TC1, TC2 |
| R5 | Yes | Yes | 2+ | member/admin/viewer | - | 200, row deleted | TC8, TC9 |
| R6 | Yes | Yes | 2+ | owner | 0 | 409 `sole_owner`; UI: Can't leave | TC3, TC4 |
| R7 | Yes | Yes | 2+ | owner | 1+ | 200, row deleted | TC18 (BLOCKED) |

Collapsed: R4 rows for every role behave identically (`last_membership` precedes role checks) — one TC with the sole-owner representative (strongest precedence probe).

### 5. State transitions — membership + active workspace

| From | Trigger | Guard | To | TC |
| --- | --- | --- | --- | --- |
| member, ws active | confirm leave | R5 | not member; active = oldest remaining | TC8 |
| member, ws not active | confirm leave | R5 | not member; active unchanged | TC9 |
| member | cancel / Esc / click-outside | - | unchanged | TC7 |
| not member | DELETE again (double-submit) | - | 404, unchanged (invalid transition) | TC13 |
| not member | re-invite accepted | - | member again, new `joined_at` | TC17 |
| only membership | leave | R4 | rejected, unchanged | TC1, TC2 |
| sole owner | leave | R6 | rejected, unchanged | TC3, TC4 |

### 6. TC outlines

Layers: UI = /settings/workspaces; API = DELETE /api/v1/workspaces/{id}/membership; DB = `workspace*members`, `access*tokens`, content tables.

| TC | Title | Type | Layer | Priority | Precondition | Expected |
| --- | --- | --- | --- | --- | --- | --- |
| TC1 | BK-90: TC1: Validate Leave action is not rendered when the user belongs to only one workspace | Boundary | UI | P0 | P2 has exactly 1 membership (BK90 Shared, sole owner) | No workspace-leave-bk90-shared, no Can't-leave note, no modal reachable |
| TC2 | BK-90: TC2: Validate leave API returns 409 `last*membership` when the user has only one workspace | Boundary | API + DB | P0 | Same as TC1 (cookie session) | 409 conflict, reason `last*membership` (not `sole_owner`); P2 row unchanged |
| TC3 | BK-90: TC3: Validate Can't leave lock note replaces Leave for a sole owner with two or more workspaces | Negative | UI | P0 | P2 sole owner of Shared + member of a 2nd workspace | Shared row shows Can't leave + ownership copy; no Leave button |
| TC4 | BK-90: TC4: Validate leave API returns 409 `sole*owner` for a sole owner with two or more workspaces | Negative | API + DB | P0 | Same as TC3 | 409 conflict, reason `sole*owner`; row + PATs unchanged |
| TC5 | BK-90: TC5: Validate confirmation dialog names the workspace and slug when leaving the active workspace | Positive | UI | P1 | P1 member of Shared (active) + Home | Modal (role alertdialog) shows "BK90 Shared" + bk90-shared + active-workspace note; focus on input |
| TC6 | BK-90: TC6: Validate Leave button enables only on an exact case-sensitive workspace name match | Boundary | UI | P1 | Modal open for BK90 Shared | Enabled only for rows marked enabled in the parametrization table below |
| TC7 | BK-90: TC7: Validate dismissing the dialog keeps membership and active workspace unchanged | Edge | UI + DB | P2 | Modal open for Shared | Cancel / Esc / click-outside: row still listed, active unchanged, DB row present |
| TC8 | BK-90: TC8: Validate leaving the active workspace removes membership and falls back to the oldest remaining workspace | Positive | UI + API + DB | P0 | P1 in Home (joined first) + Shared (active) | 200 with newActiveWorkspaceName BK90 P1 Home; Shared row gone; chrome shows Home; success copy; `bk*active*ws` rotated; Shared row deleted in DB |
| TC9 | BK-90: TC9: Validate leaving a non-active workspace keeps the current active workspace | Positive | UI + API | P1 | P1 re-invited to Shared; Home active | 200; active stays Home; no cookie rotation; Shared row gone |
| TC10 | BK-90: TC10: Validate authored content stays intact and becomes inaccessible after leaving | Positive | API + DB | P0 | P1 authored project/module/story/AC/ATC in Shared (Test Data) | Row counts + ids in Shared unchanged (P2 can still read them); P1 GET on those ids denied |
| TC11 | BK-90: TC11: Validate only PATs scoped to the left workspace are revoked | Positive | API + DB | P0 | P1 PATs: scoped-shared, scoped-home-control, setup (null ws) | Only bk90-p1-scoped-shared gets `revoked_at` (same txn); other two NULL; revoked PAT rejected by API |
| TC12 | BK-90: TC12: Validate leave API rejects a PAT bearer caller | Negative | API + DB | P1 | P1 still member of Shared; valid PAT | Rejected ("Personal access tokens cannot leave a workspace. Use a browser session."); status code to be recorded; no DB change |
| TC13 | BK-90: TC13: Validate leave API returns 404 `not*found` for a non-member caller | Negative | API | P1 | Rows: P2 on BK90 P1 Home (never member); P1 on Shared right after TC8 (double-submit) | 404 `not*found`; no DB change |
| TC14 | BK-90: TC14: Validate leave API returns 401 for an unauthenticated request | Negative | API | P1 | No cookie, no bearer | 401 unauthorized; no DB change |
| TC15 | BK-90: TC15: Validate leave API returns 400 `bad*request` for a malformed workspace id | Negative | API | P2 | Rows: not-a-uuid, empty segment, uuid missing a char | 400 `bad*request`; RPC not called |
| TC16 | BK-90: TC16: Validate rapid double-click on confirm sends a single leave request | Edge | UI | P2 | Modal open, name typed | One DELETE in network log; no error toast; one success message |
| TC17 | BK-90: TC17: Validate a user who left can be re-invited and regains access | Edge | UI + API + DB | P2 | After TC8 | New `workspace*members` row with new `joined*at`; Shared visible again; content readable |
| TC18 | BK-90: TC18: Validate co-owner can leave when another active owner remains | Positive | UI + API + DB | P1 | BLOCKED — no path to a 2nd owner | Leave available; 200; remaining owner role unchanged |
| TC19 | BK-90: TC19: Validate sole-owner guard ignores a suspended co-owner row | Edge | API + DB | P2 | BLOCKED — needs a 2nd owner row (EC-1) | 409 `sole_owner` when the other owner is not active |

***TC6 parametrization (workspace name "BK90 Shared")***

| Typed value | Partition | Leave enabled |
| --- | --- | --- |
| (empty) | empty | No |
| BK90 Shar | partial prefix | No |
| BK90 Shared! | name + 1 extra char | No |
| bk90 shared | case mismatch | No |
| BK90  Shared (double inner space) | inner whitespace | No |
| bk90-shared | slug instead of name | No |
| "  BK90 Shared  " (leading/trailing spaces) | trimmed exact | Yes |
| BK90 Shared | exact | Yes |

***TC10 / TC11 DB checks*** — before vs after counts of projects, modules, user stories, acceptance criteria, ATCs where `workspace*id` = BK90 Shared (expect equal, same ids); `access*tokens`.`revoked*at` per named PAT; `workspace*members` has no (P1, Shared) row.

### 7. Blocked scope — Scenario C

> ***WARNING:*** TC18 and TC19 are BLOCKED / PARKED. No product path creates a second active owner on staging: Settings > Members is "soon", invites cap at admin (POST /invites accepts viewer, member, admin), no role-change API, and QA does not bypass the app via direct DB writes. Asked Ely on BK-90 (2026-10-08) whether to seed via DB or move Scenario C to the member-role story. Also note: the Scenario C precondition must include a 2nd membership for the co-owner, otherwise `last_membership` blocks first.

### 8. Execution order constraints

1. Scenario A FIRST: TC1, TC2 with P2 while P2 has exactly one workspace. Do not add P2 anywhere before this.
2. Give P2 a 2nd membership (P2 creates a new workspace) — then TC3, TC4 (Scenario 2).
3. Any time: TC13 row 1, TC14, TC15.
4. P1 with BK90 Shared active, BEFORE leaving: TC5, TC6, TC7, TC12.
5. P1 leaves Shared (one leave): TC8 + TC10 + TC11 together, then immediately TC13 row 2 (double-submit at API).
6. P2 re-invites P1 to Shared: TC17. Then with BK90 P1 Home active: TC9 + TC16 (one leave).
7. Never leave BK90 P1 Home (P1 base workspace).

### 9. Data feasibility

| Scenario | Data | Pattern | Status |
| --- | --- | --- | --- |
| A | P2 single membership | Generate (seeded) | Ready |
| 2 | P2 sole owner + 2nd membership | Modify (create workspace after A) | Ready after step 1 |
| 1 / B | P1 member of Shared with authored content + 3 PATs | Generate (seeded) | Ready |
| EC-7 / re-run | P1 back in Shared | Modify (re-invite) | Depends on invite acceptance working for P1 |
| A (member-role variant) | single-ws user with role member | Generate | Gap — SMTP rate limit blocked extra personas; covered by R4 precedence |
| C | 2 active owners | Generate | BLOCKED |

### 10. Exploratory charters (error guessing)

- Stale second tab still on BK90 Shared after leaving: navigation and writes must be denied, no 500.
- Back button after leave: no cached access to Shared pages.
- Workspace name with unicode / emoji / HTML in type-to-confirm (render escaped, match exact).
- Keyboard-only + screen reader: focus trap, live region announcement (workspaces-live-region).
- Concurrent co-owner leave race (accepted by design, migration L44-48) — exploratory only, blocked with Scenario C.

### 11. Coverage

| Type | Count | TCs |
| --- | --- | --- |
| Positive | 5 | TC5, TC8, TC9, TC10, TC11 |
| Negative | 6 | TC3, TC4, TC12, TC13, TC14, TC15 |
| Boundary | 3 | TC1, TC2, TC6 |
| Edge | 3 | TC7, TC16, TC17 |
| Blocked | 2 | TC18, TC19 |

In scope: 17 outlines (P0 7, P1 6, P2 4) + 2 blocked. AC conformance is the floor (Scenarios 1, 2, A, B); risk beyond AC = TC6, TC7, TC9, TC12-TC17 + charters.

### 12. AC gaps and open questions

- Confirm mechanism: resolved in code as type-to-confirm (mockup + Impl Plan Decision 4); AC field still says "open" — PO wording update pending. Tested as type-to-confirm.
- Scenario 2 note cites a "sole owner" badge; code renders only the Can't leave note — confirm whether the badge is required.
- Action label "Leave" vs AC "Leave workspace"; modal copy "next one on your list" vs BR-1 oldest `joined_at` — wording drift to confirm.
- API contract not in ACs: PAT bearer rejection, double-submit returns 404 (not idempotent) — tested as implemented.
- Scenario C scope pending Ely (see section 7).

### 13. Observation (candidate finding — Stage 3 decides)

During test-data setup, a NON-member POST /api/v1/workspaces/{id}/projects returned 422 `project*limit*reached` on a workspace with 0/3 projects. Expected 403/404. Not filed; to be verified in Stage 2.

---
_Synced from Jira by sync-jira-issues_
