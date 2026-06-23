# Context — BK-10: TMS-Module | Rename and soft-delete a module

## Session Info
- **Date**: 2026-06-17
- **Session type**: RESUME (prior run: 2026-06-08 by Jorgelina Abdo)
- **TMS Modality**: jira-native
- **Story status**: In Test (moved back by Ely on 2026-06-11 after BK-93 reported)

## What Is Being Re-Tested
Only **TC-I04** needs to be re-run this session.

Prior ATR (2026-06-08): **25/28 PASS, 1 FAIL (TC-I04), 2 NOT TESTABLE (TC-I01, TC-I03)**

TC-I04 tested PAT bearer auth on PATCH/DELETE module endpoints. It failed with 401 — traced to BK-93, which was closed as a duplicate of BK-84. BK-84 fixed via ADR-0001 (unified auth gateway) and verified 2026-06-10 with an 8-route matrix that included module + workspace endpoints (0×401). TC-I04 must now be re-run to confirm the fix applies.

## Test Data (from prior session)
- **Workspace**: `7049b1a0-2ff9-4309-8754-f99ee7f8f4be`
- **Project**: `696bfcbf-0eb9-4c62-889f-31918493ce3d`
- **Viewer user**: `bk10-viewer@fenooldeav.resend.app`
- **PAT**: from `.env` → `API_TOKEN`

## Covered in Prior Session (not re-run unless TC-I04 impacts)
| TC Block | Status |
|---|---|
| TC-A01–A04 (Auth boundary) | PASS |
| TC-N01–N08 (Negative / validation) | ALL PASS |
| TC-B01–B04 (Boundary values) | ALL PASS |
| TC-P01–P07 (Positive flows) | ALL PASS |
| TC-I02, TC-I05 (Integration) | PASS |
| TC-I01 | NOT TESTABLE — dev DB injection required |
| TC-I03 | NOT TESTABLE — search endpoint not deployed |
| **TC-I04** | **FAIL → re-run this session** |

## Open Technical Questions
1. **PAT scope for PATCH/DELETE modules?** — not confirmed; TC-I04 is the live gate for this.
2. **`include_archived` flag implementation?** — out of scope for this re-run.
3. **TC-I01 rollback testable?** — NO. Requires dev DB injection to trigger mid-transaction error. Remains NOT TESTABLE.
4. **TC-I03 search exclusion testable?** — NO. Search endpoint not deployed on staging. Remains NOT TESTABLE.
5. **ATC detail deep-link archived filter?** — ATC detail page does not filter out archived rows. Non-blocking; candidate for follow-up ticket.

## Known Extra Coverage (prior session)
- Sibling collision path covered beyond AC spec: 409 `module_slug_duplicate` confirmed when slug of renamed module collides with an existing sibling.

## Known Follow-Ups (non-blocking for BK-10 close)
- ATC detail deep-link page does not filter archived rows (observed but non-blocking per Ely's comment)
- `tests`/`bugs` cascade intentionally out of scope — will be addressed in downstream epics

## Session Notes
- Staging reachable: YES (HTTP 307 confirmed as of session start)
- BK-93: RESOLVED — closed as duplicate of BK-84; BK-84 fix verified 2026-06-10
- If TC-I04 PASS → update ATR to 26/28, post QA comment, transition to QA Approved
- If TC-I04 FAIL → file new bug, post QA comment, story remains blocked
