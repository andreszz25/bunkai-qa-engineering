---
tms_modality: jira-native
active_env: staging
scope: BK-27
shift_left_short_circuit: true
finalized_atp_outlines: "19 (3 Positive, 5 Negative, 4 Boundary, 4 Integration, 3 API)"
stage: "COMPLETE — QA Approved 2026-06-17"
---

# BK-27 — Test Session Memory

- **TMS modality**: jira-native (no Xray) — ATP/ATR live in Story custom fields + comment mirrors.
- **Active environment**: staging (`https://staging-upexbunkai.vercel.app`).
- **Scope**: BK-27 only (sibling stories BK-28/32/33/34/21/22 out of scope for this session).
- **Shift-left short-circuit**: TRUE. Label `shift-left-reviewed` + `shift-left-2026-06-06`.
- **Finalized ATP**: 19 outlines (reconciled from 25 DRAFT → 19 authoritative). Stage 1 completed 2026-06-15.
- **Pointer**: full session notes, AC summary, dev QA-focus areas, verbatim copy table, non-disclosure contract → `./context.md`.

## Data Seed (2026-06-17) — workspace pivot

Original ATP referenced workspace `qa-bk8-1780533325` (`bc75c0d4-...`) owned by a different user. PAT user (`bunkai-staging-user@veluarzooo.resend.app`, `c4cb73a7-...`) has no membership there. **Pivoted** to PAT user's own workspaces:

### Primary workspace (all P/N/B/I/A tests)
- **Workspace**: "BK-9 QA Testing" — `baa9bff7-9db2-4ed4-b6b6-b9a86051bfac` (slug: `bk9-qa-testing`)
- **Project**: "BK-9 Module Test Project" — `ae10a3bd-574f-4caf-8076-f19a8e80f5a6` (slug: `bk-9-module-test-project`)
- **Module**: "Login" — `70f0b29b-074f-44e1-884f-161e539f4002`
- **User Story**: `a1b2c3d4-0001-4000-8000-000000000001` (seeded via SQL)
- **AC**: `a1b2c3d4-0002-4000-8000-000000000001` (seeded via SQL)

### ATCs (seeded via API 2026-06-17)

| Alias | ID | Workspace | Status | Use |
|---|---|---|---|---|
| ATC-1 | `0b3e72bc-0204-47d0-8941-3678f85a2c14` | bk9-qa-testing | active | P1/P2/P3/I3/A1-A3 |
| ATC-2 | `4f085bf7-a980-4609-b41d-a390d17fe323` | bk9-qa-testing | active | P1/P2/I3 |
| ATC-3 | `89342e9a-e5a6-4125-a9b0-babac1cb5761` | bk9-qa-testing | active | P1 |
| ATC-4 | `d1ac2f51-d0a5-4b44-93f4-9b5a0514dbab` | bk9-qa-testing | **archived** | N5 |
| ATC-X | `75d43956-2d2c-485c-8680-ac647338281a` | test-1780792458472 | active | N3/I4 |

### Foreign workspace (N3/I4)
- **Workspace**: "BK9 Integration 1780792458472" — `39ab44de-d63a-4b52-9108-376bf8326a50` (slug: `test-1780792458472`)

### Blocker status
- [x] ≥3 selectable ATCs in primary workspace (ATC-1/2/3) → P1/P2/I3
- [x] ≥1 archived ATC in primary workspace (ATC-4) → N5
- [x] ≥1 ATC in foreign workspace (ATC-X) → N3/I4
- [ ] ≥1 viewer-role member in primary workspace → N6 (DEFERRED — needs 2nd Supabase Auth user)

## Stage 2 Results (2026-06-17)

**16 PASSED / 1 DEFERRED / 1 PARTIAL / 1 NOT REPRO / 0 BUGS**

Observations:
1. N2/B1: Zod validation catches before RPC — response messages are generic Zod, not verbatim spec copy. Functionally correct.
2. I4: Workspace switch via UI navigates away, destroying form. Binding-instant only testable via API (already covered by N3-N5).
3. N6 deferred: no 2nd Supabase Auth user with viewer role in staging.
