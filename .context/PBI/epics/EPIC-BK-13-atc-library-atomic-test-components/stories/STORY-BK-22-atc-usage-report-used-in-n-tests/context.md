# BK-22: TMS-ATC Usage | See a "Used in N tests" report
**Ticket:** BK-22 | **Module (= Epic):** BK-13 ATC Library (Atomic Test Components) | **Status:** Shift-Left QA | **Sprint:** n/a — pre-sprint

## Acceptance Criteria (original)
- AC1: An ATC chained into four Tests shows "Used in 4 tests" on its detail page
- AC2: Expanding the usage report lists each Test and the position the ATC holds within it
- AC3: An ATC not chained into any Test shows "Used in 0 tests" and an empty Test list
- AC4: Only Tests in the same workspace are counted (cross-workspace Tests are excluded)

## Team Discussion (from comments)
- Ely (5/20/2026 00:57): Architect Annotation — API `GET /atcs/{id}/usage` returns 200 `{ used_in: [...] }`. 404 with `atc_not_found` for cross-workspace ATC (existence leak prevention). Multi-position: same Test multiple positions returns multiple rows, no deduplication. No caching in MVP. Upstream deps: BK-18 (atcs table), EPIC-BK-5 (`test_steps` + `tests` tables). Downstream: powers delete-ATC confirmation modal (future story).
- Ely (5/20/2026 08:24): Architect Annotation (rich-format test) — empty result returns `{ used_in: [] }` NOT 404. Performance: index on `test_steps(atc_id)` required; < 50ms p95 with 10k Tests in fixture. Optimistically hydrated from `atc.updated` event emitted by BK-21.

## Parent epic
BK-13: ATC Library (Atomic Test Components)

## Pre-sprint status
Shift-Left refinement: in progress (started 2026-06-02)
