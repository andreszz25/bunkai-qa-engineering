# Shift-Left Refinement — BK-9: TMS-Module | Create modules with nested sub-modules

**Date:** 2026-06-02
**Skill:** /shift-left-testing
**Jira:** https://jira.upexgalaxy.com/browse/BK-9
**Epic:** BK-7 — Project & Module Hierarchy
**Risk Level:** HIGH — blocks US + ATC authoring for the entire downstream hierarchy

---

## 1. Critical Analysis

### Implementation State (code-read, no execution — Phase 1 Key Findings)

- **Complexity:** HIGH — 5–7 SP equivalent (depth state machine × 3 paths, tree integrity, RLS isolation, path materialization, position ordering).
- **Blocks everything downstream:** Modules are prerequisite for US + ATC authoring — this story unblocks the core product workflow.
- **No write API at refinement time:** `POST /api/v1/modules` did not exist; `Sidebar` was read-only. BK-9 had to ship both the endpoint and the UI trigger from scratch.

### Critical Contradiction (Phase 2)

**Depth thresholds:** Business Rules field said *"Creating at depth 4 or deeper returns a soft warning."* AC4 said the warning fires at level 5 (parent at depth 4). Data-map confirmed depth 5 = warn, depth 7 = block.

**Resolution:** ACs are authoritative — warning fires when resulting depth = 5 or 6.

---

## 2. Story Quality Analysis

**Verdict at refinement time:** Needs Improvement (story had gaps)

### Gaps (ACs absent from story)

| Gap | Note |
|---|---|
| Missing AC | 80-char name upper boundary not covered |
| Missing AC | Viewer-role authorization gate not covered |
| Missing AC | Description field (resolved later by PO — see §3) |
| Ambiguity | ACs use paraphrased error messages — exact text open for AC3 (min name) and AC5 (depth exceeded) |
| Blocker | Implementation pattern unspecified — blocks integration test strategy |

---

## 3. Refined Acceptance Criteria — PO Answers received 2026-06-02

- Warning fires when resulting depth = 5 OR 6 (parent at depth 4+). No warning at depths 1–4.
- Depth enforcement: app layer (early return) + DB constraint (safety net). Error code: `MODULE_DEPTH_EXCEEDED`.
- Description: optional, max 500 chars, Markdown stored, renders in tree view below module name — 3-line truncate + "more" expand. 501+ chars rejected.

### New scenarios added

- **E1:** Accept name = 80 chars (max boundary)
- **E2:** Reject name = 81 chars
- **E3:** Reject whitespace-only name
- **E4:** Reject viewer-role creation (HTTP 403)
- **E5:** Reject cross-project `parent_module_id`
- **E6:** Verify position = last sibling + 1

---

## 4. ATP DRAFT — Test Coverage Estimate (25 outlines)

| Type | Count |
|---|---|
| Positive | 6 |
| Negative | 8 |
| Boundary | 4 |
| Integration | 4 |
| API | 3 |
| **Total** | **25** |

> Full 25-outline ATP table was authored at sprint-testing time (2026-06-06) and lives in `acceptance-test-plan.md` / Jira "Acceptance Test Plan" custom field — this section reflects the original Phase 4 coverage estimate from the shift-left pass.

---

## 5. Edge Cases Identified

- Name at exact boundaries: 2 chars (min) and 80 chars (max) must be accepted.
- Name of 81 chars must be rejected.
- Whitespace-only name must be rejected (treated as empty).
- Special characters (emoji, RTL, HTML tags) must be sanitized / stored as literal text.
- Viewer-role user attempting module creation must receive 403 / button disabled in UI.
- Concurrent sibling creates: position ordering must be deterministic.
- Cross-workspace: user from WS-A cannot create modules in WS-B.
- Depth 6 creation: module IS created, warning IS shown.
- Description of 501+ chars: rejected with validation message.

---

## 6. Open Questions for Dev (non-blocking for PO)

| # | Question |
|---|---|
| Q1 | Module creation pattern: REST endpoint (`POST /api/v1/modules`) or Server Action / Supabase RPC? |
| Q2 | Position assignment strategy on concurrent sibling creates? |
| Q3 | Does `POST /api/v1/modules` support `Idempotency-Key` header? |
| Q4 | Does module creation write to `activity_log`? |
| Q5 | Does Supabase Realtime broadcast on `modules` INSERT? |
| Q6 | Exact error message text for AC3 (min name) and AC5 (depth exceeded)? |

> Resolved 2026-06-04 — see Ely's "Ready for QA — BK-9 deployed to staging" comment ("As-built contract"): endpoint shipped as `POST /api/v1/projects/{id}/modules` (cookie-session auth, NOT PAT bearer); position increments deterministically (verified TC-25); `Idempotency-Key` NOT supported (confirmed in ATR "Notable Findings"); error reasons landed as `name_too_short` / `name_too_long` / `name_no_alphanumeric` / `depth_exceeded` / `module_slug_duplicate` / `parent_invalid` / `not_a_member`.

---

## 7. Risks

| Risk | Likelihood | Impact |
|---|---|---|
| Depth threshold built at wrong level (fires at 4 instead of 5) | Medium | High |
| `path` column not correctly materialized after nested create | Medium | High |
| Module creation not RLS-scoped (cross-workspace access) | Low | Critical |
| Position collision under concurrent creates | Low | Medium |

---

## 8. QA Feedback Summary

**Story health at refinement:** Needs Improvement — gaps and one critical contradiction (depth threshold) found.

**Resolution:** PO answered all open questions same-day (2026-06-02), refined ACs landed in the story description, story moved through estimation → development → staging. Sprint-testing (2026-06-06) confirmed all 25 functional TCs PASS, with the depth≥5 threshold and position-increment behavior validated exactly as refined here (see `acceptance-test-results.md`).

---

_Generated by /shift-left-testing on 2026-06-02 — Refined by Luis Eduardo Flores Villarroel (Shift-Left batch session)._
_Jira mirror: BK-9 comment thread, "Shift-Left Refinement" post, 6/2/2026 1:36 AM (see `comments.md`)._

---

> **Reconstruction note (2026-06-07):** This file was missing from the local PBI folder even though the Jira-mirrored comment in `comments.md` (and the QA Refinements section in `story.md`) explicitly referenced it at this exact path — a broken traceability link. Rebuilt verbatim from the Phase 1–4 analysis already captured in `comments.md` (Luis Eduardo Flores Villarroel, 6/2/2026) and the "QA Refinements" section of `story.md`. No new analysis was invented; content is a structural reorganization of what was already recorded, following the BK-8 `shift-left-refinement.md` format as the reference template.
