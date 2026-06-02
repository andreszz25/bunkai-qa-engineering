# Create a Workspace

**Jira Key:** [BK-4](https://upexgalaxy67.atlassian.net/browse/BK-4)
**Epic:** [BK-1](https://upexgalaxy67.atlassian.net/browse/BK-1) (Tenancy & Identity)
**Priority:** Medium
**Story Points:** -
**Status:** Ready For QA

---

## User Story

## QA Refinements (Shift-Left Analysis) — BK-4

### Story Quality: Needs Improvement

- Original: single-sentence Story with business rules
- Missing: reserved slug list, error catalog, Unicode normalization rules

### Refined Acceptance Criteria (13 Given/When/Then scenarios, 4 ACs)

***AC-1 Positive***: POST /workspaces with name "Acme QA" → 201 workspace created, slug "acme-qa", caller is owner
***AC-2 Positive***: Slug is derived: lowercase, kebab-case, accents stripped, ≤60 chars
***AC-3 Positive***: Creator auto-enrolled as owner in workspace_members
***AC-4 Slug uniqueness***: Duplicate slug → 409 Conflict
***AC-5 Reserved slugs***: Reserved value → 422 Validation Failed
***AC-6 Name validation***: 0 chars, 61 chars, no alphanumeric → 422
***AC-7 Empty string name*** → 422

### Edge Cases (18 identified)

- Unicode name: "Bünkāï" → slug "bunkai" (NEEDS PO/DEV CONFIRMATION)
- Emoji-only name → 422
- Leading/trailing spaces → trimmed
- Concurrent slug race → 409 for loser
- Workspace creation event fired → activity log entry

### Critical PO Questions

1. SLUG_RESERVED list — what values are reserved? (suspect: admin, api, app, auth, ~20 others)
2. Unicode normalization algorithm (NFKD? ASCII-only?)
3. Error catalog — what status code per validation failure?
4. Response shape: Story says {workspace_id, slug}, API map says {id, slug, role, plan}

### Test Outlines (20 — names only)

***Positive (6)***: Workspace created with valid name, slug derived correctly, owner membership, event emission, activity log, GET returns workspace
***Negative (8)***: Name too short/long, duplicate slug, reserved slug, no alphanumeric, empty name, unauthenticated, emoji-only, Unicode boundary
***Boundary (4)***: Exact 3/60 char name, slug approaching 60 char limit, accented boundary
***API (2)***: GET /workspaces/{id} returns workspace, 404 for non-existent

---

## Acceptance Criteria

```gherkin
Scenario: Successful workspace creation
Given an authenticated user
When they POST /api/v1/workspaces with name "Acme QA"
Then the system inserts a row in workspaces with the auto-derived slug "acme-qa"
And inserts the creator into workspace_members with role "owner"
And returns 201 with body { workspace_id, slug: "acme-qa" }

Scenario: Name too short rejected
Given an authenticated user
When they submit a workspace name "A" (1 char)
Then the system returns 400 with code NAME*TOO*SHORT (min 3 chars)

Scenario: Reserved slug rejected
Given an authenticated user
When they submit name "API" which slugifies to "api"
Then the system returns 400 with code SLUG_RESERVED
And the response lists the reserved slugs (api, app, auth, admin, bunkai, ...)

Scenario: Duplicate name per owner case-insensitive
Given a user who already owns a workspace named "Acme QA"
When they POST a second workspace with name "acme qa"
Then the system returns 409 with code NAME*DUPLICATE*FOR_OWNER

Scenario: workspace.created event emitted
Given a successful workspace creation
When the row is inserted
Then a workspace.created event is emitted on the realtime channel for the owner
```

---

## Business Rules

- name MUST be 3-60 chars, contain ≥1 alphanumeric.

- slug derived from name: lowercase, kebab-case (spaces → hyphens, accents stripped), strip leading/trailing hyphens, max 60 chars.

- slug MUST be globally unique across all workspaces.

- slug MUST NOT match any reserved value (loaded from config).

- Creator inherits role owner; no other roles assignable at create-time.

---

## Scope

- POST /api/v1/workspaces endpoint
- Name validation: 3-60 chars, unique per owner (case-insensitive)
- Slug auto-derivation: lowercase, kebab-case, globally unique
- Reserved-slug rejection list (api, app, auth, admin, bunkai, ...)
- Creator auto-added as owner in workspace_members
- workspace.created event

---

## Workflow

1. Authenticated user clicks "Create Workspace".

2. UI shows name input + slug preview computed client-side.

3. User submits.

4. POST /api/v1/workspaces with { name }.

5. Server validates name length + alphanumeric requirement.

6. Server derives slug, checks reserved list + global uniqueness.

7. Insert workspaces row in transaction with workspace_members row (role=owner).

8. Emit workspace.created event.

9. Return 201 with { workspace_id, slug }.

10. UI navigates to new workspace's home.

---

## Definition of Done

- [ ] Implementation complete
- [ ] Unit tests written
- [ ] Code reviewed
- [ ] Documentation updated

---

## Metadata

- **Created:** 5/19/2026
- **Updated:** 5/28/2026
- **Reporter:** Ely
- **Assignee:** Ely
- **Labels:** mvp, shift-left-2026-05-27, shift-left-reviewed, tenancy, wave-1

---

_Synced from Jira by sync-jira-issues_
_Last sync: 2026-05-28T08:58:33.897Z_
