# BK-9 — Test Session Memory

Shared payload across all 4 sub-agent dispatches for this sprint-testing session.

---

## Environment
- Active env: staging
- WEB_URL: https://staging-upexbunkai.vercel.app
- API_URL: https://staging-upexbunkai.vercel.app/api/v1
- DB_MCP: staging-dbhub (connected, schema verified)
- Cookie jar: /tmp/bk9-cookies.txt (session auth, 2026-06-06)

## TMS Modality
jira-native — ATP/ATR stored as Jira custom fields (🧪 Acceptance Test Plan / 🧪 Acceptance Test Results). No Xray.

## Test Data
- Project ID for testing: ed871b20-aacb-49bb-b636-88bbd00b5440 ("Smoke Checkout")
- Existing depth-1 modules: 
  - id: 06644460-519a-4289-904b-d9146fd33f40 (Payments / path: payments)
  - id: 18d6cbf9-4221-42c9-b3c9-20f22d04b58a (Refunds and Credits / path: refunds-and-credits)
- For depth chain testing: needs dynamic creation of 4-deep chain

## As-Built Contract (from dev comments.md)
- Success: 201 { module: {id, project_id, parent_module_id, path, name, position, description, created_at}, warning? }
- Warning fires ONLY at resulting depth >= 5 (string, not boolean)
- name_too_short: 422, reason: name_too_short (min = 2, NOT 3)
- name_too_long: 422, reason: name_too_long (max = 80)
- name_no_alphanumeric: 422, reason: name_no_alphanumeric
- description_too_long: 422, reason: description_too_long
- depth_exceeded: 422, reason: depth_exceeded (> 6)
- module_slug_duplicate: 409, reason: module_slug_duplicate
- parent_invalid: 422, reason: parent_invalid
- not_a_member: 403, reason: not_a_member
- bad UUID / invalid JSON: 400
- unauthenticated: 401

## Session State
- Session Start: in_progress (2026-06-06)
- Stage 1: pending
- Stage 2: pending
- Stage 3: pending

## Key Pre-Test Findings (code review)
1. WARNING_TOAST_NO_SUCCESS: On 201 at depth >= 5, warning toast fires but NOT success toast → user confusion
2. CLIENT_MIN_LENGTH_GAP: isValid only checks length > 0, not >= 2
3. CHECKLIST_DEPTH_MISMATCH: Dev checklist says "depth 4" warning but code/AC says depth >= 5
