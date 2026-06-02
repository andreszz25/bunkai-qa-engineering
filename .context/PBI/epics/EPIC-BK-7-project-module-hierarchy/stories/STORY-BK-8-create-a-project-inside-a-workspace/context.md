# BK-8 — Create a Project inside a Workspace

**Epic:** BK-7 — Project & Module Hierarchy  
**Status:** Shift-Left QA  
**Priority:** Medium  
**Labels:** hierarchy, mvp, wave-1

## Acceptance Criteria (original)

```gherkin
Scenario: Successful Project creation
Given a workspace member of Workspace W
When they POST /api/v1/workspaces/W/projects with { name: "Checkout v2" }
Then the system inserts a row in projects with slug "checkout-v2" auto-derived
And returns 201 with { project_id, slug: "checkout-v2" }

Scenario: Name too short rejected
Given a workspace member
When they submit name "AB" (2 chars)
Then the system returns 400 with code NAME*TOO*SHORT (min 3 chars)

Scenario: Duplicate slug in workspace rejected
Given workspace W already has a Project with slug "checkout-v2"
When a member POSTs another Project with name "Checkout V2"
Then the system returns 409 with code SLUG*DUPLICATE*IN_WORKSPACE

Scenario: Member cannot create in workspace they do not belong to
Given an authenticated user who is NOT a member of Workspace X
When they POST /api/v1/workspaces/X/projects
Then the system returns 403 with code NOT*A*MEMBER
```

## Session Notes

- Shift-Left refinement run: 2026-05-28
- API endpoint does NOT exist yet (`app/api/v1/` has no workspaces route)
- DB schema ready: `projects` table + RLS in migration 0002
- UI placeholder in `projects/page.tsx` says "Phase E"
- 7 open questions for PO/Dev — see shift-left-refinement.md
