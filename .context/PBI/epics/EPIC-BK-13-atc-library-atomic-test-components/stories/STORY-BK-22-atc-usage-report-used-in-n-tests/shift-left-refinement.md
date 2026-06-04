# Shift-Left Refinement: BK-22 — TMS-ATC Usage | See a "Used in N tests" report

**Status**: Refined — Awaiting PO Estimation
**Mode**: Shift-Left (pre-sprint, batch grooming)
**Refined on**: 2026-06-02
**Refined by**: QA — Shift-Left batch session
**Modality**: Jira-native

---

## Phase 1 — Critical Analysis

### Business context
- **Primary persona affected**: Senior QA Engineer (Elena) — needs blast-radius awareness before editing or removing an ATC to avoid unknowingly breaking tests that reference it
- **Secondary personas (if any)**: QA Team Lead reviewing coverage impact; Dev implementing ATC removal (future story) who depends on the impact modal
- **Business value proposition**: Prevents silent regressions caused by ATC modifications without awareness of downstream test dependencies; completes the IQL (Integrated Quality Lifecycle) traceability chain from ATC back to Tests
- **KPI(s) influenced**: Reduction in unintentional test-coverage gaps caused by ATC edits; time-to-detect blast radius before a change is made
- **User journey position**: Step 3 of the ATC detail flow — after opening the ATC and before deciding to edit or remove it (per `workflow.md`)

### Technical context
- **Frontend**: ATC detail page (`app/(app)/projects/[projectSlug]/atcs/[atcId]/`) — a read-only reporting widget that shows the "Used in N tests" count and an expandable list of Tests with their `position_in_test` values. Deep links to each Test page. No state mutation, no form submission.
- **Backend**: `GET /atcs/{id}/usage` — greenfield endpoint (not yet scaffolded; no `app/api/v1/atcs/` directory exists). Returns `{ used_in: [{ test_id, slug, title, position_in_test }] }`. Workspace scoping enforced at service layer. ATC existence check runs first to decide 404 vs 200.
- **External services**: None (PostgreSQL only — confirmed by Architect Annotation)
- **Integration points specific to this Story**:
  - `test_steps` table (upstream: EPIC-BK-5) — must exist with `atc_id`, `position` columns for the JOIN query to work
  - `tests` table (upstream: EPIC-BK-5) — must exist with `workspace_id`, `slug`, `title` columns
  - `atcs` table (upstream: BK-18) — already confirmed present in `0004_atcs.sql`
  - BK-21 (`atc.updated` event) — this endpoint is also called optimistically when BK-21 emits the update event; hydration contract is downstream

### Story complexity
| Axis | Rating | Why |
|------|--------|-----|
| Business logic | Low | Read-only query with workspace scoping; no write path, no state machine |
| Integration | Medium | Depends on `test_steps` + `tests` tables from EPIC-BK-5, which do NOT yet exist in the schema; greenfield API route with workspace-scoped 404 semantics |
| Data validation | Low | No user inputs; the only validation is ATC existence + workspace membership |
| UI | Low | Read-only widget — count label + expandable list + deep links; no interactive mutation |

**Estimated test effort**: Medium (3–4 outlines for the API layer; 2–3 UI outlines). Multi-position edge case and workspace isolation are the highest-complexity scenarios. Confidence is limited until EPIC-BK-5 lands `test_steps` and `tests` — without those tables this endpoint always returns `{ used_in: [] }`.

### Epic-level inheritance (if applicable)
- **Risks restated at Story level**: The `test_steps` and `tests` tables are defined by EPIC-BK-5, not BK-13. BK-22 has a hard dependency on that Epic. If EPIC-BK-5 is not completed first, BK-22 can deliver the API and widget shell but will always return empty results — making functional QA impossible.
- **Integration points inherited**: Workspace scoping pattern (all BK-13 endpoints enforce `workspace_id` isolation via RLS + service-layer WHERE); 404-not-403 security pattern for cross-workspace existence leak prevention (established in BK-13 / BK-18).
- **PO/Dev answers already given at epic level**: None documented at epic level that directly apply to BK-22 yet.
- **Test strategy inherited**: API-first verification (curl smoke on known ATC with usage), then UI integration; workspace isolation is a required negative scenario for every endpoint in BK-13.

---

## Phase 2 — Story Quality Analysis

### Ambiguities

| # | Location in Story | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|-------------------|---------------------|-------------------|------------------------|
| 1 | AC2: "I see each Test and the position the ATC holds within it" | When the same ATC appears at positions 2 AND 5 within Test-A, does the list show Test-A once (collapsed) or twice (one row per position)? The Architect Annotation says "no deduplication" (multiple rows), but the UI copy "each Test" implies one row per Test. | Cannot write a correct assertion for the expanded list count | Specify whether the list is grouped by Test (with comma-separated positions) or is a flat row-per-position list. Architect Annotation §multi-position is the source of truth — confirm it drives UI row count too. |
| 2 | AC1 + AC2: "Used in N tests" count | Does N count distinct Tests or total row count? If ATC is at positions 2 and 5 in Test-A and position 1 in Test-B, is N = 2 (distinct Tests) or N = 3 (rows)? The query in Architect Annotation returns multiple rows without deduplication — but the count label says "tests", implying distinct. | The assertion for the count label will be wrong if the counting rule is not specified | Clarify count semantics: DISTINCT test_id count vs raw row count. Business phrasing "N tests" strongly implies distinct. |
| 3 | AC4: "Tests in the same workspace are not counted" | The current AC describes the outcome for a cross-workspace Test but does not specify what the user sees. Is the ATC detail page still rendered with `{ used_in: [] }` (empty, no error), or does the page show a different state? | Cannot design the negative UI scenario — is it "empty list" or an error message? | Clarify: cross-workspace Tests are silently excluded from the count (ATC renders normally with an accurate lower count), distinct from the 404 scenario where the ATC itself is from another workspace. |
| 4 | workflow.md: "She uses this to judge impact before editing or removing the ATC" | Scope says "Use the report as an impact preview before editing or removing the ATC" — but editing and removing are covered by different stories (BK-21, future delete story). Is the widget interactive during editing (live update as steps are moved) or only on the read-only detail page? | Determines whether the widget needs a loading/stale state during ATC mutation | Confirm: widget is read-only on detail page only, not embedded in the editor. |

### Gaps (missing info)

| # | Type | Why critical | What to add | Risk if omitted |
|---|------|--------------|-------------|-----------------|
| 1 | AC | No AC covers the 404 behavior when the ATC ID belongs to a different workspace. Architect Annotation specifies 404 with `atc_not_found` code — but no AC validates this. | Add explicit AC: "Given an ATC ID that belongs to a different workspace, when I call GET /atcs/{id}/usage, then I receive 404 with error code `atc_not_found`" | Security regression — without this AC a Dev might accidentally implement 403 (which leaks ATC existence) or 200 with empty result (different semantics) |
| 2 | AC | No AC covers the `{ used_in: [] }` vs 404 distinction for an ATC with zero usage. AC3 covers the UI ("empty list") but not the API shape. Architect Annotation explicitly says empty → `{ used_in: [] }` NOT 404. | Add API-level AC: "Given a valid ATC with no test_steps references, GET /atcs/{id}/usage returns 200 `{ used_in: [] }`" | Developer may return 404 for unused ATCs, breaking the UI widget when it expects a 200 with an empty array |
| 3 | Technical detail | Performance budget (< 50ms p95, ≤ 100 Tests per Annotation; < 50ms p95 with 10k Tests per second Annotation) is contradictory across the two Architect Annotations. | Reconcile and document the authoritative performance target in AC or DoD. | Cannot write a valid performance test — the two Annotations give conflicting fixture sizes (100 Tests vs 10k Tests). |
| 4 | Business rule | No business rule covers the minimum role required to call this endpoint. Architect Annotation says "caller role ≥ viewer" — but the ACs and Business Rules table are silent on authorization. | Add to Business Rules: "Viewer-role workspace members can read ATC usage reports." | Risk: Dev implements a member-or-higher gate, blocking viewer-role users from seeing reports; or leaves it open to unauthenticated callers. |
| 5 | AC | No AC covers the list ordering. Architect Annotation defines ORDER BY `t.slug ASC, ts.position ASC` — but the ACs do not specify sort order. | Add to Business Rules or AC: "Tests are listed ordered by slug ascending; within the same Test, positions are listed ascending." | In-sprint QA cannot write a deterministic order assertion; flaky tests in automation |

### Edge cases not in Story

| # | Scenario | Expected behavior (best guess) | Criticality | Action |
|---|----------|-------------------------------|-------------|--------|
| 1 | Same ATC referenced at two positions in the same Test (e.g. position 2 and position 5) | Per Architect Annotation: two rows in the API response. UI behavior (one row or two) is unspecified. | High | Add to AC — NEEDS PO/DEV CONFIRMATION |
| 2 | ATC referenced in 100+ Tests (at or above the documented performance boundary) | API returns 200 with full list; response time stays within the p95 budget | Medium | Test only — performance boundary case |
| 3 | ATC referenced in exactly 1 Test at exactly position 1 | API returns `{ used_in: [{ test_id, slug, title, position_in_test: 1 }] }` with count showing "Used in 1 test" (singular vs plural) | Medium | Add to AC — plural/singular copy is not addressed in current ACs — NEEDS PO/DEV CONFIRMATION |
| 4 | ATC not yet referenced by any test (fresh ATC, zero usage) — called immediately after creation | Returns 200 `{ used_in: [] }`, UI shows "Used in 0 tests". Already partially in AC3 but the API shape is missing. | High | Add to AC (API shape) — NEEDS PO/DEV CONFIRMATION |
| 5 | ATC ID is a valid UUID but does not exist in the `atcs` table at all (not just cross-workspace) | Should return 404 `atc_not_found` — same code as cross-workspace case to avoid differentiating existence vs access | Medium | Test only (security case) — NEEDS PO/DEV CONFIRMATION |
| 6 | Unauthenticated caller (no session, no PAT) calls GET /atcs/{id}/usage | Should return 401 — standard Supabase Auth middleware behavior, but not documented in AC | Medium | Test only — NEEDS PO/DEV CONFIRMATION |
| 7 | Test is deleted after being referenced in `test_steps` — the JOIN returns a missing `tests` row | Depends on FK cascade behavior from EPIC-BK-5 `tests` table definition. If no CASCADE DELETE on `test_steps.test_id`, the JOIN may return orphaned `test_steps` rows. | High | Technical question for Dev — NEEDS PO/DEV CONFIRMATION |
| 8 | `test_steps` table does not exist yet (EPIC-BK-5 not merged) — endpoint called | Endpoint should return 200 `{ used_in: [] }` or 503 depending on implementation. Behavior when the dependency table is absent must be defined. | Medium | Technical question for Dev |

### Contradictions

- **Architect Annotation 1 (5/20 00:57) vs Annotation 2 (5/20 08:24) — performance budget**: Annotation 1 states "< 50ms p95 on ATCs referenced in ≤ 100 Tests". Annotation 2 states "< 50ms p95 with 10k Tests in fixture". These are contradictory fixture sizes for the same metric. The authoritative target must be resolved before Dev writes the index-validation unit test and before QA can write a performance outline.
- **Architect Annotation 2 (second SQL block) vs Annotation 1**: Annotation 2 contains a simplified SQL without the `workspace_id` WHERE clause (`ORDER BY t.created_at` instead of `ORDER BY t.slug ASC, ts.position ASC`). This appears to be a simplified illustration for the rich-format test comment, NOT the authoritative query. Annotation 1's query (with workspace scoping and explicit sort) should be treated as authoritative. Dev must confirm which query shape is implemented.
- **AC2 "each Test" vs "no deduplication"**: AC2 says "I see each Test" (implying one entry per Test), while Architect Annotation says the JOIN returns multiple rows without deduplication. These are consistent only if "each Test" is interpreted as "each Test-position pair". PO must clarify the list rendering model.

### Testability validation
**Verdict**: Partial

Issues:
- **Missing performance criteria**: Contradictory fixture sizes (100 vs 10k Tests) in the two Architect Annotations. Cannot write a deterministic performance outline until reconciled.
- **Missing ordering specification in ACs**: Architect Annotation defines ORDER BY but ACs don't. Automated assertions against list order will be fragile until ordering is official.
- **Upstream table dependency**: `tests` and `test_steps` tables are from EPIC-BK-5, which does not yet exist in the schema (confirmed — no migration creates them). The entire positive path (AC1, AC2) cannot be executed until EPIC-BK-5 lands. Current state: the endpoint, if built now, would always return `{ used_in: [] }`.
- **No error message copy**: ACs do not specify exact UI message for the cross-workspace or not-found cases. Cannot assert exact text strings.

---

## Phase 3 — Refined Acceptance Criteria

### Original AC1 — Count of Tests using an ATC

#### Scenario 1.1: Should show "Used in N tests" count for ATC referenced in multiple Tests (Type: Positive, Priority: Critical)
- **Given**: workspace W1 has ATC `atc-slug-a` referenced in 4 Tests within the same workspace; the user is authenticated as a workspace member (role ≥ viewer) of W1
- **When**: the user opens the ATC detail page for `atc-slug-a`
- **Then**:
  - UI: the usage widget displays "Used in 4 tests"
  - API: `GET /atcs/{atc-slug-a-id}/usage` returns HTTP 200 with body `{ "used_in": [ ...4 or more entries... ] }` (N distinct Test entries)
  - DB: no mutation; read-only query against `test_steps` JOIN `tests`
  - System state: unchanged

---

### Original AC2 — Expanding the report to list Tests and positions

#### Scenario 2.1: Should list each Test with the ATC's position when usage report is expanded (Type: Positive, Priority: High)
- **Given**: ATC `atc-slug-a` is referenced by Test-A at position 3, Test-B at position 1, Test-C at position 7, Test-D at position 2; user is authenticated
- **When**: the user expands the usage report on the ATC detail page
- **Then**:
  - UI: the expanded list shows 4 entries; each entry displays the Test title and the ATC's position within that Test
  - API: response body contains 4 objects each with `test_id`, `slug`, `title`, `position_in_test` fields
  - List order: entries are ordered by Test slug ascending, then position ascending (per Architect Annotation)
  - DB: no mutation

#### Scenario 2.2: Should show multiple rows when one Test references the same ATC at multiple positions (Type: Edge, Priority: High) — NEEDS PO/DEV CONFIRMATION
- **NEEDS PO/DEV CONFIRMATION**: multi-position rendering in UI is not specified in the Story. This scenario is inferred from the Architect Annotation ("no deduplication"). Confirm whether the UI shows one row per Test (with all positions listed) or one row per Test-position pair.
- **Given**: ATC `atc-slug-b` is referenced by Test-X at position 2 AND at position 5 (same test, two steps use this ATC)
- **When**: the usage report is expanded
- **Then**:
  - API: `GET /atcs/{atc-slug-b-id}/usage` returns HTTP 200 with at minimum 2 entries for Test-X: `{ position_in_test: 2 }` and `{ position_in_test: 5 }`
  - UI: rendering behavior to be confirmed by PO — either two rows for Test-X or one row with "positions: 2, 5"
  - Count label: **NEEDS PO/DEV CONFIRMATION** — should read "Used in 1 test" (1 distinct Test) or "Used in 2 steps" (2 positions)?

---

### Original AC3 — Zero-usage ATC

#### Scenario 3.1: Should show "Used in 0 tests" and empty list for an ATC with no test_steps references (Type: Positive, Priority: High)
- **Given**: ATC `atc-slug-c` exists in workspace W1 and has no rows in `test_steps` with `atc_id = atc-slug-c-id`; user is authenticated
- **When**: the user opens the ATC detail page for `atc-slug-c`
- **Then**:
  - UI: the widget displays "Used in 0 tests"; the expandable list is empty (or the expand control is absent/disabled)
  - API: `GET /atcs/{atc-slug-c-id}/usage` returns HTTP 200 with body `{ "used_in": [] }` — NOT 404
  - DB: no mutation

#### Scenario 3.2: Should return 200 with empty array (not 404) for an ATC with zero usage — API contract (Type: API, Priority: Critical) — NEEDS PO/DEV CONFIRMATION
- **NEEDS PO/DEV CONFIRMATION**: the explicit `{ used_in: [] }` vs 404 distinction is in the Architect Annotation but not in any AC. This scenario formalizes that contract.
- **Given**: ATC `atc-slug-c` exists in workspace W1 with no test_steps referencing it
- **When**: `GET /atcs/{atc-slug-c-id}/usage` is called with a valid session cookie or PAT (atc:read scope)
- **Then**:
  - API: HTTP 200 `{ "used_in": [] }`
  - NOT: HTTP 404 with any error code

---

### Original AC4 — Workspace scoping

#### Scenario 4.1: Should exclude Tests from other workspaces from the usage count (Type: Negative, Priority: Critical)
- **Given**: ATC `atc-slug-a` belongs to workspace W1; Test-Z belongs to workspace W2 and references `atc-slug-a` via `test_steps`; user is authenticated in workspace W1
- **When**: the user opens the usage report for `atc-slug-a` in W1
- **Then**:
  - UI: Test-Z is NOT listed; count reflects only W1 Tests
  - API: `GET /atcs/{atc-slug-a-id}/usage` returns 200 with `used_in` array containing only Tests where `t.workspace_id = W1`
  - DB: no mutation; WHERE clause enforces workspace scoping

#### Scenario 4.2: Should return 404 (not 403 or 200) when the ATC belongs to a different workspace — NEEDS PO/DEV CONFIRMATION
- **NEEDS PO/DEV CONFIRMATION**: this scenario is in Architect Annotation but not in any AC. It formalizes the existence-leak prevention requirement.
- **Given**: ATC `atc-slug-x` belongs to workspace W2; user is authenticated in workspace W1
- **When**: `GET /atcs/{atc-slug-x-id}/usage` is called from W1 context
- **Then**:
  - API: HTTP 404 with body `{ "error": "atc_not_found" }` (or equivalent error code)
  - NOT: HTTP 403 (which would confirm the ATC exists in another workspace — information leak)
  - NOT: HTTP 200 with empty `used_in` (ambiguous — indistinguishable from a valid ATC with zero usage)

---

### New scenarios surfaced from Phase 2 edge cases

#### Scenario E1: Should return "Used in 1 test" in singular form for ATC referenced in exactly one Test (Type: Boundary, Priority: Medium) — NEEDS PO/DEV CONFIRMATION
- **NEEDS PO/DEV CONFIRMATION**: singular vs plural label copy ("1 test" vs "1 tests") is not addressed in the Story. Inferred from standard UX grammar convention.
- **Given**: ATC `atc-slug-d` is referenced by exactly 1 Test at position 1
- **When**: the user opens the ATC detail page
- **Then**: UI displays "Used in 1 test" (singular) — NOT "Used in 1 tests"

#### Scenario E2: Should return 404 for a valid UUID that does not exist in the atcs table (Type: Negative, Priority: Medium) — NEEDS PO/DEV CONFIRMATION
- **NEEDS PO/DEV CONFIRMATION**: behavior for a non-existent ATC UUID (not cross-workspace, but truly absent) is inferred from the 404-for-cross-workspace pattern.
- **Given**: a UUID `00000000-0000-0000-0000-000000000000` that does not correspond to any row in `atcs`
- **When**: `GET /atcs/00000000-0000-0000-0000-000000000000/usage` is called
- **Then**: HTTP 404 with error code `atc_not_found` — same response as cross-workspace case (no existence leak)

#### Scenario E3: Should return 401 for unauthenticated caller (Type: Negative, Priority: High) — NEEDS PO/DEV CONFIRMATION
- **NEEDS PO/DEV CONFIRMATION**: no AC specifies auth behavior for this endpoint. Inferred from BK-13's global pattern that all ATC endpoints require active workspace membership.
- **Given**: no session cookie and no Authorization header
- **When**: `GET /atcs/{id}/usage` is called
- **Then**: HTTP 401 — consistent with all other protected BK-13 endpoints

---

## Phase 4 — Test Outlines (DRAFT — outline names only)

### Coverage estimate
| Type | Count | Notes |
|------|-------|-------|
| Positive | 3 | Happy path: count display, expanded list, zero-usage state |
| Negative | 4 | Cross-workspace ATC (404), non-existent ATC (404), unauthenticated (401), wrong scope PAT |
| Boundary | 3 | Singular count (1 test), multi-position same Test, ATC at 100+ Tests |
| Integration | 2 | API↔DB workspace scoping; UI↔API empty-array-not-404 contract |
| API | 3 | Response shape validation (used_in array), 200 vs 404 distinction, ordering contract |
| **Total** | **15** | (drives PO estimation) |

**Rationale**: The story is a read-only reporting widget (low UI complexity) but has two high-stakes correctness requirements: workspace isolation (security) and the 200-vs-404 semantics for zero-usage and cross-workspace cases. The integration and API outlines are critical precisely because the Architect Annotation specifies non-obvious behavior (empty array NOT 404). Boundary coverage is modest because the only meaningful boundaries are the zero-count state and the multi-position case. Total of 15 reflects medium effort aligned with the Medium integration complexity rating from Phase 1.

---

### Outline list (NAMES ONLY — preconditions in 1 line, expected in 1 line)

#### Positive
- **Should display "Used in N tests" count for an ATC referenced in multiple Tests** — Pre: authenticated user in W1, ATC with 4 Test references. Expected: widget shows "Used in 4 tests"; API 200 with 4 entries in `used_in`.
- **Should list each Test with position when usage report is expanded** — Pre: ATC referenced in 3 Tests at known positions; user authenticated. Expected: expanded list shows 3 entries with correct Test titles and `position_in_test` values, ordered by slug then position.
- **Should show "Used in 0 tests" and empty list for a new ATC with no test_steps** — Pre: ATC exists in workspace with zero `test_steps` references. Expected: widget shows "Used in 0 tests"; expand shows empty state; API returns 200 `{ used_in: [] }`.

#### Negative
- **Should return 404 with atc_not_found when ATC belongs to a different workspace** — Pre: valid ATC ID from workspace W2; caller is authenticated in workspace W1. Expected: HTTP 404 `{ "error": "atc_not_found" }`, NOT 403.
- **Should return 404 for a UUID that does not exist in the atcs table** — Pre: syntactically valid UUID absent from atcs. Expected: HTTP 404 `atc_not_found`; same response shape as cross-workspace case.
- **Should return 401 for an unauthenticated GET /atcs/{id}/usage request** — Pre: no session cookie, no Authorization header. Expected: HTTP 401; no data returned.
- **Should return 403 when PAT lacks atc:read scope** — Pre: valid PAT with only `run:execute` scope. Expected: HTTP 403; endpoint reachable but scope gate rejects.

#### Boundary
- **Should display "Used in 1 test" in singular when ATC is referenced in exactly one Test** — Pre: ATC with exactly 1 `test_steps` reference; user authenticated. Expected: label reads "Used in 1 test" (singular).
- **Should return multiple rows for an ATC referenced at two positions within the same Test** — Pre: ATC referenced at positions 2 and 5 in Test-X. Expected: API returns at least 2 entries for Test-X with distinct `position_in_test` values; count label behavior confirmed by PO.
- **Should return a complete list and 200 for an ATC referenced in 100+ Tests** — Pre: ATC with ≥ 100 `test_steps` references in the same workspace. Expected: HTTP 200 with full `used_in` array; no truncation; response within performance budget.

#### Integration
- **Should validate workspace_id scoping in the SQL JOIN — Tests from W2 must not appear when caller is in W1** — Pre: `test_steps` rows in W1 and W2 both referencing the same `atc_id`; caller in W1. Expected: only W1 Test entries in `used_in`; W2 entries silently excluded.
- **Should confirm that GET /atcs/{id}/usage returns 200 with empty array (not 404) for an ATC with zero usage** — Pre: ATC with no `test_steps` references. Expected: HTTP 200 `{ "used_in": [] }` — API shape contract aligned with Architect Annotation.

#### API
- **Should validate response schema shape — each item has test_id, slug, title, position_in_test** — Pre: ATC with known usage. Expected: each object in `used_in` array contains all four required fields with correct types.
- **Should validate list ordering — Tests ordered by slug ASC, positions within same Test by position ASC** — Pre: ATC referenced in Tests with slugs out of alphabetical order; one Test with multiple positions. Expected: response array follows the defined sort order.
- **Should return OpenAPI-compliant response for GET /atcs/{id}/usage** — Pre: OpenAPI spec generated via `bun run api:sync`. Expected: response shape matches the documented schema; no undocumented fields.

> **NOT included here** (deferred to in-sprint planning by `/sprint-testing` Stage 1): parametrization tables, per-outline test-data JSON, numbered test steps, Faker generation strategies. Coverage estimate IS included because PO uses it for estimation.

---

## Phase 5 — Edge Cases (DRAFT)

| # | Edge case | In original Story? | Criticality | Action |
|---|-----------|-------------------|-------------|--------|
| 1 | Same ATC at multiple positions within one Test (multi-position JOIN rows) | No (only in Architect Annotation) | High | Add to AC (PO confirm) |
| 2 | ATC with zero usage — API returns `{ used_in: [] }` NOT 404 | Partially (AC3 covers UI; API shape missing) | High | Add API-level AC (PO confirm) |
| 3 | Cross-workspace ATC request returns 404, NOT 403 or 200 | No (only in Architect Annotation) | High | Add to AC (PO confirm) |
| 4 | "Used in 1 test" singular copy | No | Medium | Add to AC (PO confirm) |
| 5 | Unauthenticated caller gets 401 | No | High | Test only (NEEDS PO/DEV CONFIRMATION) |
| 6 | PAT with wrong scope gets 403 | No | Medium | Test only (NEEDS PO/DEV CONFIRMATION) |
| 7 | ATC UUID does not exist at all (not cross-workspace, just absent) | No | Medium | Test only (NEEDS PO/DEV CONFIRMATION) |
| 8 | ATC referenced in 100+ Tests — performance boundary | No (only in Architect Annotation, contradictory fixture sizes) | Medium | Test only after performance target reconciled |
| 9 | `test_steps` table absent (EPIC-BK-5 not merged) — endpoint behavior | No | High | Technical question for Dev |
| 10 | Test deleted after being referenced in `test_steps` — orphan rows | No | High | Technical question for Dev (FK cascade rule from EPIC-BK-5) |
| 11 | ATC referenced in 0 Tests AND `test_steps` table doesn't exist yet | No | Medium | Technical question for Dev |

> Test-data generation strategy + Faker recipes are NOT defined here. They land in `/sprint-testing` Stage 1 when the feature exists.

---

## Story Quality Assessment

**Verdict**: Needs Improvement

**Key findings**:
- The Story's ACs cover the primary happy-path and workspace-isolation requirement, but leave three security-critical behaviors entirely to the Architect Annotation: the 404-not-403 pattern for cross-workspace ATCs, the `{ used_in: [] }` API contract for zero-usage ATCs, and the minimum role required to call the endpoint. These must be formalized in the ACs before sprint planning — they directly affect what Dev implements and what QA verifies.
- The multi-position edge case (same ATC at two positions in one Test) is documented in the Architect Annotation but the UI rendering rule (one row per Test vs one row per Test-position pair) is unresolved. This ambiguity creates contradictory assertions depending on which interpretation is implemented.
- The Story has a hard upstream dependency on EPIC-BK-5 (`tests` and `test_steps` tables) which does not yet exist in the DB schema. Building BK-22 before EPIC-BK-5 is complete is technically possible (shell + empty response) but functional QA is blocked until both tables exist.

---

## Critical Questions for PO

> These BLOCK sprint planning until answered.

1. **When the same ATC appears at two positions within one Test, does the usage list show one row (Test-A, positions: 2, 5) or two rows (Test-A at position 2; Test-A at position 5)?**
   - **Context**: AC2 says "each Test"; Architect Annotation says JOIN returns multiple rows without deduplication. These are consistent only if "each Test" means "each Test-position pair". The count label (N = distinct Tests or N = total rows) depends on the same answer.
   - **Impact if unanswered**: Dev implements one model; QA tests the other. The count assertion in AC1 will either pass or fail based on which interpretation Dev chose, with no way to tell which is correct.
   - **Suggested answer**: Display one row per Test with all positions listed (comma-separated), and count = distinct Tests. This matches the business phrasing "Used in N tests" and is the most user-readable format for the blast-radius use case.

2. **Does "Used in 1 test" show the singular form, or is it always "Used in N tests"?**
   - **Context**: No AC addresses singular vs plural. Standard UX convention requires it but the exact copy is undefined.
   - **Impact if unanswered**: UI copy will be inconsistent ("Used in 1 tests" is grammatically wrong); no way to write a deterministic text assertion.
   - **Suggested answer**: Singular form: "Used in 1 test". Plural form: "Used in N tests" (N ≥ 2 or N = 0).

3. **What is the authoritative performance target for the GET /atcs/{id}/usage endpoint — "≤ 100 Tests" or "10k Tests" in the benchmark fixture?**
   - **Context**: Architect Annotation 1 says "< 50ms p95 on ATCs referenced in ≤ 100 Tests"; Annotation 2 says "< 50ms p95 with 10k Tests in fixture". These are contradictory.
   - **Impact if unanswered**: Dev writes a unit test against the wrong fixture size; QA cannot write a valid performance outline; the DoD performance check is untestable.
   - **Suggested answer**: Clarify which fixture size is the production baseline expectation. 10k is more realistic for a mature TMS; 100 may be an MVP shortcut.

---

## Technical Questions for Dev

> These do not block PO but block implementation.

1. **What is the FK cascade behavior on `test_steps.test_id` when a Test is deleted? If no CASCADE DELETE, orphaned `test_steps` rows will pollute the usage report with references to deleted Tests.** — The cascade rule is set by EPIC-BK-5. Confirm whether the usage query's JOIN will naturally exclude orphaned rows (via the INNER JOIN) or whether orphaned `test_steps` rows need a cleanup guard.

2. **If `test_steps` and `tests` tables do not yet exist (EPIC-BK-5 not merged), what does the endpoint return? 200 with `{ used_in: [] }`, 503 Service Unavailable, or a migration gate error?** — This defines the behavior during the window between BK-22 landing and EPIC-BK-5 landing, which matters for CI integration tests.

3. **Which SQL query shape is authoritative — Annotation 1 (with `t.workspace_id = $session.workspace_id` WHERE clause and `ORDER BY t.slug ASC, ts.position ASC`) or Annotation 2 (simplified, no workspace WHERE, `ORDER BY t.created_at`)?** — QA will write ordering assertions against the authoritative query.

---

## Suggested Story Improvements

| # | Current state | Suggested change | Benefit |
|---|---------------|------------------|---------|
| 1 | ACs cover UI behavior only; API contract (200 vs 404 for zero-usage, 404 vs 403 for cross-workspace) is only in Architect Annotation | Add two explicit API-contract ACs: (a) empty ATC → 200 `{ used_in: [] }`; (b) cross-workspace ATC → 404 `atc_not_found` | Security and correctness requirements become verifiable AC items; Dev and QA share the same contract |
| 2 | Business Rules table is silent on minimum required role | Add rule: "Caller must be an active workspace member (role ≥ viewer) — 401 if unauthenticated, 404 if ATC is outside caller's workspace" | Removes ambiguity about auth gate; QA can write an authorization negative scenario |
| 3 | No ordering specification in ACs or Business Rules | Add to Business Rules: "Tests are listed ordered by slug ascending; within the same Test, positions are listed ascending" | Deterministic assertions; prevents non-deterministic UI ordering surprises |
| 4 | "Used in N tests" copy without singular case | Specify: "Used in 1 test" (singular) / "Used in N tests" (N ≠ 1) | Prevents grammatically incorrect UI copy; enables text assertions in automation |
| 5 | Performance target contradictory across two Annotations | Document a single authoritative budget in a Business Rule or the DoD | Enables a valid performance test outline; aligns Dev unit test fixture size with QA expectations |

---

## Data feasibility flags

- **Entity / fixture missing**: `tests` and `test_steps` tables are from EPIC-BK-5. Neither table exists in any current migration (`0001_tenancy.sql` through `0008_access_tokens.sql` confirmed). Without these tables, the `GET /atcs/{id}/usage` query cannot be executed and will always return an empty result.
- **API contract gap**: `GET /atcs/{id}/usage` route does not exist — no `app/api/v1/atcs/` directory found in the backend repo. This is a greenfield endpoint. The API surface confirmed in `business-data-map.md §9` does not include any ATC data endpoints (all ATC mutations go through Next.js Server Actions + Supabase RPC).
- **Required pre-work**: EPIC-BK-5 must land (creates `tests` + `test_steps` tables with correct columns and the `test_steps(atc_id)` index) before any functional QA on BK-22 positive scenarios is possible. BK-18 (atcs table) is confirmed present — not a blocker.
- **Index dependency**: Architect Annotation references `test_steps(atc_id)` index as a performance requirement. The existing `0004_atcs.sql` creates `atc_steps_atc_id_idx on public.atc_steps (atc_id)` — this is the `atc_steps` table (ATC internal steps), NOT the `test_steps` table (Test→ATC associations from EPIC-BK-5). The required index is a different table and does not yet exist.

---

## Recommended testing strategy

### Pre-implementation
- Confirm EPIC-BK-5 delivery order with Dev lead — BK-22 must be queued after EPIC-BK-5 ships the `tests` + `test_steps` tables
- PO answers the 3 Critical Questions (multi-position display model, singular copy, performance budget) before Dev writes a line of code
- Dev answers the 3 Technical Questions (FK cascade, pre-EPIC-BK-5 behavior, authoritative SQL) before QA writes API outlines

### During implementation
- API-first: verify `GET /atcs/{id}/usage` response shape with curl against staging before any UI work (`bun run api:sync` must pass first)
- Unit test workspace scoping with two workspace fixtures in isolation — the security invariant is the highest-risk behavior
- Verify 404-not-403 explicitly for cross-workspace case via integration test (as specified in DoD)

### Post-implementation (in-sprint by /sprint-testing)
- Stage 1: expand outlines with parametrization (Test counts: 0, 1, 4, multi-position), per-outline test-data JSON, numbered steps
- Execute API outlines first (curl or Playwright API context) — faster feedback, no UI dependency
- Execute UI outlines after API is confirmed passing — use data-testid selectors established during `/adapt-framework`
- Run workspace isolation negative scenario as a mandatory smoke test before every regression cycle (security regression gate)
- Performance outline deferred until authoritative fixture size is confirmed

---

## Risks & mitigation

| # | Risk | Likelihood | Impact | Mitigated by which outlines |
|---|------|-----------|--------|-----------------------------|
| 1 | EPIC-BK-5 (`tests` + `test_steps`) not landed before BK-22 enters sprint | High (separate epic, no explicit dependency gate) | High — all positive test scenarios blocked | Data feasibility flag; recommend sprint sequencing gate |
| 2 | Dev implements 403 instead of 404 for cross-workspace ATC (existence leak) | Medium (easy mistake) | High — security vulnerability | Scenario 4.2; Outline "Should return 404 with atc_not_found when ATC belongs to different workspace" |
| 3 | Dev returns 404 for zero-usage ATC instead of 200 + empty array (breaks UI widget) | Medium (non-obvious contract) | Medium — UI widget fails on unused ATCs | Scenario 3.2; Outline "Should confirm that GET /atcs/{id}/usage returns 200 with empty array" |
| 4 | Multi-position display model unresolved — Dev and QA implement contradictory behavior | Medium (ambiguity in current ACs) | Medium — incorrect blast-radius count | Scenario 2.2; Critical Question #1 must be answered before sprint |
| 5 | Performance regression if `test_steps(atc_id)` index is missing from EPIC-BK-5 migration | Low (Architect Annotation calls it out explicitly) | Medium — slow queries under load | Outline "Should return complete list and 200 for ATC referenced in 100+ Tests" |

---

## Next steps

- [ ] PO answers Critical Questions before sprint planning (multi-position display, singular copy, performance budget)
- [ ] Dev answers Technical Questions before estimation (FK cascade, pre-EPIC-BK-5 behavior, authoritative SQL)
- [ ] Confirm EPIC-BK-5 sprint sequencing — BK-22 should not enter dev until `tests` + `test_steps` tables exist in staging
- [ ] Story enters sprint at status `Ready For Dev` once estimated and Critical Questions are answered
- [ ] When Story reaches `Ready For QA`, `/sprint-testing` will short-circuit refinement (label `shift-left-reviewed` detected) and go directly to Phase 4 with parametrization + test-data JSON
