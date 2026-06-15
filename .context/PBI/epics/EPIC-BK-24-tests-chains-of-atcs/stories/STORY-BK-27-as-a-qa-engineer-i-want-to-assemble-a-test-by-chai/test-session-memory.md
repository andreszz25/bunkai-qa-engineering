---
tms_modality: jira-native
active_env: staging
scope: BK-27
shift_left_short_circuit: true
existing_atp_outlines: "25 (5 Positive, 6 Negative, 7 Boundary, 7 Integration per acceptance-test-plan.md Phase 4)"
---

# BK-27 — Test Session Memory

- **TMS modality**: jira-native (no Xray) — ATP/ATR live in Story custom fields + comment mirrors.
- **Active environment**: staging (`https://staging-upexbunkai.vercel.app`).
- **Scope**: BK-27 only (sibling stories BK-28/32/33/34/21/22 out of scope for this session).
- **Shift-left short-circuit**: TRUE. Story carries labels `shift-left-reviewed` + `shift-left-2026-06-06` (< 30 days old as of 2026-06-15). Stage 1 (acceptance-test-planning.md) SKIPS Phases 1-3, continues from **Phase 4** (the 25-outline ATP DRAFT already exists in `acceptance-test-plan.md`).
- **Existing ATP outlines**: 25 total (5 Positive, 6 Negative, 7 Boundary, 7 Integration) per `acceptance-test-plan.md` Phase 4. Note: implementation handoff comment (6/12/2026) instead references "19 ATP TCs" and a `compliance-matrix.md` — Stage 1 Phase 4 should reconcile the 25 vs 19 count against the compliance matrix before finalizing the in-sprint ATP.
- **Pointer**: full session notes, AC summary, dev QA-focus areas, verbatim copy table, non-disclosure contract, and staging test-data candidates → `./context.md`.
