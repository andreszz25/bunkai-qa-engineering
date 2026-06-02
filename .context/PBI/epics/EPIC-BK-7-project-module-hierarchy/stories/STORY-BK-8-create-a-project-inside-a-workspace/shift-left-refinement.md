# Shift-Left Refinement — BK-8: Create a Project inside a Workspace

**Date:** 2026-05-28  
**Skill:** /shift-left-testing  
**Jira:** https://upexgalaxy67.atlassian.net/browse/BK-8  
**Epic:** BK-7 — Project & Module Hierarchy  
**Risk Level:** HIGH (9/10) — gates all downstream features (modules, stories, ATCs)

---

## 1. Critical Analysis

### Implementation State (code-read, no execution)

| Component | Status | Notes |
|---|---|---|
| `POST /api/v1/workspaces/{id}/projects` | ❌ NOT EXISTS | No route in `app/api/v1/` |
| `projects` DB table | ✅ READY | `supabase/migrations/0002_projects_modules.sql` |
| RLS INSERT policy | ✅ READY | `role in (member,admin,owner) AND status=active` |
| `UNIQUE (workspace_id, slug)` constraint | ✅ READY | Enforced at DB level |
| UI "Create Project" form | ❌ NOT EXISTS | `projects/page.tsx` placeholder says "Phase E" |
| Slug derivation logic | ❌ NOT EXISTS | No `slugify()` function found for projects |

**Feasibility verdict:** DB layer fully ready. API and UI are greenfield — this story ships both from scratch.

### Dependency Chain Risk

```
BK-8 (Project) → BK-9 (Modules) → BK-14/15/16/17 (Stories + ACs) → BK-18..23 (ATCs)
```

BK-8 is the **root blocker** for the entire Wave-1 hierarchy. Any scope slip here propagates to 10+ stories.

---

## 2. Story Quality Analysis

### Ambiguities

**A1 — Error code separator: `*` vs `_`**  
The ACs use `NAME*TOO*SHORT`, `SLUG*DUPLICATE*IN_WORKSPACE`, `NOT*A*MEMBER`.  
The rest of the codebase uses `_` as separator (e.g. `otp_exchange_failed`, `rate_limited`, `missing_code`).  
This is a likely typo in Jira that will cause test failures if tests expect `NAME_TOO_SHORT` but the API returns `NAME*TOO*SHORT` (or vice versa).

**A2 — Workspace identifier: UUID vs slug in URL path**  
- AC says `POST /api/v1/workspaces/W/projects` (W looks like an ID)  
- Workflow step 9 references `/workspaces/{ws-slug}/projects/{project-slug}` (slug in UI URL)  
- The existing `onboarding` flow creates workspaces via `workspace_id` (UUID).  
- The `projects` RLS uses `workspace_id` (UUID FK). Using slug would require an extra lookup.  
- Critical design decision that locks the URL contract for ALL workspace-scoped endpoints.

**A3 — Authentication mechanism for the endpoint**  
The current API pattern splits into two worlds:  
- Cookie session: `onboarding`, `projects/[projectSlug]` pages  
- PAT bearer: `GET/POST/DELETE /api/v1/tokens`  
The story says "workspace member" implying cookie session, but `POST /api/v1/workspaces/*/projects` follows the REST API convention of bearer auth.  
If PAT: no existing scope covers project creation. `atc:write` is too narrow; `workspace:admin` is too broad.

**A4 — Slug derivation algorithm underspecified**  
Story says "lowercase, kebab-case, unique per workspace" — not sufficient for implementation:  
- Accent normalization: `"Autenticación"` → `"autenticacion"` or `"autenticaci-n"`?  
- Consecutive spaces/hyphens: `"Test  Project"` → `"test-project"` or `"test--project"`?  
- Max slug length: name max = 80 chars, slug could inherit up to 80 chars. DNS label limit = 63.  
- Collision handling: immediate 409 or auto-suffix (`-2`, `-3`)?

### Gaps (ACs absent from story)

| Gap | Business Rule source | Risk |
|---|---|---|
| G1: Viewer role → 403 | `role >= member` in Business Rules | HIGH — RLS enforces it but API must surface it correctly |
| G2: Name with only special chars (`"---"`) | `name MUST contain >=1 alphanumeric char` | HIGH — Business Rule without AC |
| G3: Name > 80 chars | Scope: `Name validation: 3-80 chars` | MEDIUM — upper bound not tested |
| G4: Description > 5KB | Business Rules: `<=5KB Markdown` | MEDIUM — Business Rule without AC |
| G5: Unknown workspace ID | (implied by 403 design) | MEDIUM — 404 vs 403 security decision |
| G6: UI form + slug preview | Workflow steps 1-3 | LOW (if UI deferred to Phase E) |

---

## 3. Refined Acceptance Criteria

```gherkin
# --- ORIGINAL ACs (refined) ---

Scenario: AC-1 — Successful project creation
  Given an authenticated user with role "member" (or higher) and active membership in Workspace W
  When they POST /api/v1/workspaces/{W.id}/projects
    with body: { "name": "Checkout v2" }
  Then the system inserts a row in `projects` with slug "checkout-v2"
  And returns HTTP 201 with body containing { "project_id": "<uuid>", "slug": "checkout-v2" }

Scenario: AC-2 — Name below minimum length rejected
  Given an authenticated workspace member
  When they POST /api/v1/workspaces/{W.id}/projects with body: { "name": "AB" }
  Then the system returns HTTP 400
  And the response error code is "NAME_TOO_SHORT"
  # NEEDS PO/DEV CONFIRMATION: error code separator — story uses * but codebase standard is _

Scenario: AC-3 — Duplicate slug in workspace rejected
  Given workspace W already contains a project with slug "checkout-v2"
  When a member POSTs { "name": "Checkout V2" } to the same workspace
  Then the system returns HTTP 409
  And the response error code is "SLUG_DUPLICATE_IN_WORKSPACE"
  # NEEDS PO/DEV CONFIRMATION: error code separator (same as AC-2)
  # NEEDS PO/DEV CONFIRMATION: does slug auto-suffix (-2, -3) instead of returning 409?

Scenario: AC-4 — Non-member cannot create project in foreign workspace
  Given an authenticated user who is NOT a member of Workspace X
  When they POST /api/v1/workspaces/{X.id}/projects with a valid body
  Then the system returns HTTP 403
  And the response error code is "NOT_A_MEMBER"
  # NEEDS PO/DEV CONFIRMATION: error code separator (same as AC-2)
  # NEEDS PO/DEV CONFIRMATION: enforced at API middleware or Supabase RLS? If RLS-only → 403 may not carry error code body

# --- NEW ACs (inferred — NEEDS PO/DEV CONFIRMATION) ---

Scenario: AC-5 — Viewer role cannot create projects
  Given an authenticated user with role "viewer" and active membership in Workspace W
  When they POST /api/v1/workspaces/{W.id}/projects with a valid body
  Then the system returns HTTP 403
  # Business Rule: role >= member required. Viewer is explicitly excluded.

Scenario: AC-6 — Name with no alphanumeric chars rejected
  Given an authenticated workspace member
  When they POST /api/v1/workspaces/{W.id}/projects with body: { "name": "---" }
  Then the system returns HTTP 400
  And the error indicates the name must contain at least one alphanumeric character

Scenario: AC-7 — Name exceeding 80 chars rejected
  Given an authenticated workspace member
  When they POST /api/v1/workspaces/{W.id}/projects
    with a name of 81 characters
  Then the system returns HTTP 400

Scenario: AC-8 — Description exceeding 5KB rejected
  Given an authenticated workspace member
  When they POST /api/v1/workspaces/{W.id}/projects
    with a description string of 5121 characters
  Then the system returns HTTP 400
  And the error indicates the description exceeds the maximum allowed size

Scenario: AC-9 — Request to non-existent workspace
  Given an authenticated user
  When they POST /api/v1/workspaces/00000000-0000-0000-0000-000000000000/projects
    with a valid body
  Then the system returns HTTP 404 or HTTP 403
  # NEEDS PO/DEV CONFIRMATION: 404 leaks workspace existence; 403 is safer for enumeration prevention

Scenario: AC-10 — Same slug allowed across different workspaces
  Given workspace A has a project with slug "checkout-v2"
  And workspace B is a separate workspace
  When a member of workspace B POSTs { "name": "Checkout v2" } to workspace B
  Then the system returns HTTP 201
  And the slug "checkout-v2" is created in workspace B without conflict
  # Verifies: UNIQUE (workspace_id, slug) constraint scope
```

---

## 4. ATP DRAFT — Test Outline

### API Layer (all outlines — POST /api/v1/workspaces/{id}/projects)

| ID | Outline Title | Type | Priority |
|---|---|---|---|
| T01 | Successful creation — valid member, valid name → 201 + slug | Positive | P1 |
| T02 | Name 2 chars → 400 NAME_TOO_SHORT | Negative | P1 |
| T03 | Name 81 chars → 400 | Negative | P1 |
| T04 | Name only special chars `"---"` → 400 | Negative | P1 |
| T05 | Duplicate slug same workspace → 409 SLUG_DUPLICATE_IN_WORKSPACE | Negative | P1 |
| T06 | Same slug different workspace → 201 (per-workspace uniqueness) | Boundary | P1 |
| T07 | Non-member → 403 NOT_A_MEMBER | Negative | P1 |
| T08 | Viewer role → 403 | Negative | P1 |
| T09 | Non-existent workspace UUID → 404 or 403 | Negative | P2 |
| T10 | Description > 5KB → 400 | Negative | P2 |
| T11 | Description null/omitted → 201 (optional field) | Boundary | P2 |
| T12 | Slug derivation: accents, spaces, uppercase, consecutive hyphens | Boundary | P2 |
| T13 | DB integrity: project row + workspace_id FK correct after 201 | Integration | P1 |
| T14 | Unauthenticated request → 401 | Negative | P1 |

### UI Layer (conditional on PO confirming UI in scope for BK-8)

| ID | Outline Title | Type | Priority |
|---|---|---|---|
| T15 | Form visible with name input + description textarea + slug preview | Positive | P1 |
| T16 | Slug preview updates in real-time as name is typed | Positive | P2 |
| T17 | Submit success → navigate to /projects/{slug} | Positive | P1 |

**Coverage totals:** 12 API (8 Negative / 2 Positive / 2 Boundary / 1 Integration / 1 Security) + 3 UI = **15 outlines**

---

## 5. Edge Cases

| Edge Case | Criticality | Notes |
|---|---|---|
| Name = exactly 3 chars (boundary min) | HIGH | Must return 201 |
| Name = exactly 80 chars (boundary max) | HIGH | Must return 201 |
| Name = 81 chars (over max) | HIGH | Must return 400 |
| Slug collision with deleted project (if soft-delete exists) | MEDIUM | Does a deleted project's slug stay reserved? Schema has no `deleted_at` on `projects` — likely hard-delete, so slug freed on delete |
| Concurrent POSTs with same name from same workspace (race condition) | HIGH | UNIQUE (workspace_id, slug) at DB level will catch one, but both requests may pass app-layer validation simultaneously → one gets 201, other gets 409. Test with sequential calls; race testing deferred to load testing. |
| Name with only whitespace `"   "` | HIGH | Should fail alphanumeric check after trim |
| Workspace_id valid UUID format but not in DB | MEDIUM | RLS INSERT policy checks membership — if workspace doesn't exist, membership check fails → 403 or 404? |

---

## 6. Open Questions for PO / Dev / Design

| # | Question | To | Impact if unresolved |
|---|---|---|---|
| **Q1** | Error codes use `_` or `*` as separator? Story writes `NAME*TOO*SHORT` but codebase convention is `NAME_TOO_SHORT`. Which is canonical? | Dev | BLOCKER — tests will validate wrong string |
| **Q2** | Path param in endpoint: workspace UUID or workspace slug? `POST /api/v1/workspaces/{uuid}/projects` vs `/workspaces/{slug}/projects` | Dev | BLOCKER — defines base URL for all test outlines |
| **Q3** | Auth mechanism: cookie session only, PAT bearer only, or both? If PAT, which scope? Is a new `project:write` scope needed? | Dev | BLOCKER — defines how ATCs authenticate in test suite |
| **Q4** | Slug collision on duplicate name: immediate 409, or auto-suffix (`-2`, `-3`) with 201? | PO + Dev | HIGH — changes T05 scenario entirely |
| **Q5** | Unknown workspace UUID: 404 (leaks existence) or 403 (security-safe enumeration prevention)? | Dev | MEDIUM — defines T09 expected outcome |
| **Q6** | Is the UI form (name input + description + slug preview + navigation) in scope for BK-8 or deferred to a separate Phase E story? | PO | MEDIUM — determines if T15/T16/T17 are in sprint scope |
| **Q7** | What is the max allowed slug length? (DNS label = 63 chars; PostgreSQL TEXT = unlimited). Auto-truncate or enforce via name max? | Dev | MEDIUM — defines T12 boundary |

---

## 7. QA Feedback Summary

**Story health:** NEEDS REFINEMENT before sprint commitment.

**Blockers (must resolve before estimation):**
- Q1, Q2, Q3 — without these answers Dev cannot write a spec and QA cannot write a test plan

**Recommendations:**
1. Fix error code separator consistency in all ACs (likely typo: `*` → `_`)
2. Add explicit AC for viewer role (Q5 is a security regression risk)
3. Add explicit AC for name-only-specials (Business Rule without coverage)
4. Decide slug collision behavior (Q4) before Dev starts — affects DB migration logic
5. Decouple UI work from API work in scope if UI is Phase E

**Risk to sprint:** HIGH if Q1+Q2+Q3 unanswered. MEDIUM if only Q4-Q7 open.

---

_Generated by /shift-left-testing on 2026-05-28_  
_Jira mirror: see BK-8 description + comment_
