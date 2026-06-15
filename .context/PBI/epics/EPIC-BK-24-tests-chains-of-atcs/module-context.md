# Module Context — EPIC-BK-24 "Tests (chains of ATCs)"

## Purpose

A **Test** is the executable unit one rung above the ATC and below the **Run**: an ordered, named chain of ATCs from a workspace's library. Epic BK-24 introduces this entity into Bunkai — without it, ATCs cannot be grouped or executed together, and the downstream Runs epic (BK-006) is blocked. The activation funnel KPI ("≥1 Module + ≥1 ATC + ≥1 Test + ≥1 Run in first 24h") depends on this epic landing.

## Related stories (traceability from BK-27)

- **BK-27** — TMS-Test Builder | Assemble a test by chaining ATCs — *Ready For QA* (this story; implemented, merged to `staging` via PR #40 / `54749ba`)
- **BK-28** — TMS-Test Builder | Reorder ATCs inside a test — *Ready For Dev*, blocked-by BK-27
- **BK-32** — TMS-Test View | View a test with all chained ATCs expanded — *Ready For Dev*
- **BK-33** — TMS-Test Tags | Assign reserved and custom tags to a test — *Ready For Dev*
- **BK-34** — TMS-Run Execution | Start a manual run in a chosen environment — *Ready For Dev*
- **BK-21** — TMS-ATC Propagation | Cascade ATC edits to all tests — *Ready For Dev*
- **BK-22** — TMS-ATC Usage | See a "Used in N tests" report — *Ready For Dev*
- **BK-18** — TMS-ATC API | Create and edit ATCs with steps and assertions — *In Test*
