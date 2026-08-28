# Test Session Memory — BK-22

## TMS Modality
jira-native

## Ticket Context
- **Key**: BK-22
- **Type**: Story
- **Title**: TMS-ATC Usage | See a "Used in N tests" report
- **Epic**: BK-13 (ATC Library — Atomic Test Components)
- **Status**: Ready For QA
- **Story Points**: 3
- **Priority**: Medium
- **Assignee**: Andrés Daniel Cumare Morales
- **Labels**: atc, mvp, reporting, shift-left-2026-06-02, shift-left-reviewed, wave-2

## Shift-Left Status
- Refined: 2026-06-02
- Label: shift-left-reviewed (< 30 days)
- Short-circuit: Stage 1 Phases 1-3 skipped, continue from Phase 4

## PO Decisions (from shift-left role-play simulation)
1. Multi-position: one row per Test, positions as inline metadata (comma-separated). Count N = distinct Tests.
2. Singular/plural: "Used in 1 test" (singular), "Used in N tests" (N != 1), "Used in 0 tests" (plural).
3. Performance: < 50ms p95 with 10k Test fixture (Annotation 2's fixture size + Annotation 1's latency target).

## Dev Decisions (from shift-left role-play simulation)
1. FK cascade: test_steps.test_id has ON DELETE CASCADE — no orphan rows.
2. Pre-EPIC-BK-5: endpoint returns 200 { used_in: [] } with Postgres 42P01 guard (not 500).
3. Authoritative SQL: Annotation 1 (workspace_id WHERE + ORDER BY t.slug ASC, ts.position ASC).

## Upstream Dependencies
- BK-18 (atcs table): QA Approved
- BK-27 (Test Builder): QA Approved
- EPIC-BK-5 (tests + test_steps tables): status TBD — required for functional QA

## PR Status
- PR created: 2026-06-20
- PR merged: 2026-06-20

## Environment
- Active env: staging
- WEB_URL: https://staging-upexbunkai.vercel.app
- API_URL: https://staging-upexbunkai.vercel.app/api

## Stage Progress
- [x] Session Start — 2026-06-23
- [x] QA Comment posted — Feature NOT deployed (2026-06-23)
- [ ] Stage 1 — Planning (PAUSED — awaiting feature deployment)
- [ ] Stage 2 — Execution
- [ ] Stage 3 — Reporting

## Blocking Finding
- Feature BK-22 NOT implemented in codebase
- No API endpoint, no UI widget, no git commits
- Jira automation "PR merged" was triggered by BK-27, not BK-22
- Session PAUSED until dev deploys the feature
