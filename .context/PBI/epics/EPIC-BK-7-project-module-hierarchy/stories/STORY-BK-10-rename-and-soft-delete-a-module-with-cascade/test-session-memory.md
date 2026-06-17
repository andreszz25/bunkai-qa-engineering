# Test Session Memory — BK-10

## Identity
- Story: BK-10 — TMS-Module | Rename and soft-delete a module
- Epic: EPIC-BK-7 (Project & Module Hierarchy)
- Session: 2026-06-17 (RESUME — prior run 2026-06-08)
- TMS Modality: jira-native

## Environment
- Active env: staging
- WEB_URL: https://staging-upexbunkai.vercel.app
- API_URL: https://staging-upexbunkai.vercel.app/api
- WEB_URL_OVERRIDE: null (use project.yaml staging)

## Session Type
RESUME — prior ATR: 25/28 PASS, 1 FAIL (TC-I04), 2 NOT TESTABLE
Target: Re-run TC-I04 only (PAT bearer auth on PATCH/DELETE module endpoints)

## Stage State
- Session Start: COMPLETE
- Stage 1 (Planning): SKIPPED (ATP exists from prior run — 28 TCs)
- Stage 2 (Execution): COMPLETE — TC-I04 re-run PASS (2026-06-17)
- Stage 3 (Reporting): COMPLETE — ATR comment posted, BK-10 → QA Approved (2026-06-17)

## Test Data
- Workspace: 7049b1a0-2ff9-4309-8754-f99ee7f8f4be
- Project: 696bfcbf-0eb9-4c62-889f-31918493ce3d
- Viewer user: bk10-viewer@fenooldeav.resend.app
- PAT: from .env API_TOKEN

## Final ATR
- TC-A01–A04: PASS
- TC-N01–N08: ALL PASS
- TC-B01–B04: ALL PASS
- TC-P01–P07: ALL PASS
- TC-I01: NOT TESTABLE
- TC-I02: PASS
- TC-I03: NOT TESTABLE
- TC-I04: PASS (re-run 2026-06-17 — BK-84 fix confirmed)
- TC-I05: PASS
- **Total: 26/28 PASS, 0 FAIL, 2 NOT TESTABLE**

## Key Technical Facts
- Routes: PATCH + DELETE app/api/v1/modules/[id]/route.ts
- Cascade: SQL transaction WITH RECURSIVE; covers modules, user_stories, acceptance_criteria, atcs
- BK-93 (PAT 401 on modules): FIXED via BK-84 / ADR-0001 (unified auth gateway)
- PAT scope for modules: unknown — TC-I04 will confirm
- tests/bugs tables: NOT in cascade scope for BK-10
- Viewer 403 confirmed: not_a_member (membership-level check, functionally correct)
- Sibling collision: 409 module_slug_duplicate confirmed

## Blocking Defects
- BK-93: RESOLVED (closed dup of BK-84; BK-84 fixed + verified 2026-06-10)

## Open Questions (resolved)
1. PAT scope for PATCH/DELETE modules? → CONFIRMED WORKING (scopes: atc:read, atc:write, run:execute, workspace:admin)
2. include_archived flag implementation? → out of scope this re-run
3. TC-I01 rollback testable? → NO (dev DB injection required)
4. TC-I03 search testable? → NO (search endpoint not deployed)
5. ATC detail deep-link archived filter? → follow-up ticket (non-blocking)

## TC-I04 Re-Run Evidence (2026-06-17)
- PATCH /api/v1/modules/2c4175d7 (rename AB → AB-PAT-Test → AB): 200 ✓
- DELETE /api/v1/modules/b8e9a75f (DescMax soft-delete): 200 {archived:{modules:1}} ✓
- PAT user: bunkai-staging-user@veluarzooo.resend.app
- Workspace: baa9bff7-9db2-4ed4-b6b6-b9a86051bfac (BK-9 QA Testing)
