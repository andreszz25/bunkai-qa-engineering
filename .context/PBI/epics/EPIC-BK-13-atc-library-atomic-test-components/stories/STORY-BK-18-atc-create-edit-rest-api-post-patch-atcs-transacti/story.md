# ATC create + edit REST API (POST/PATCH /atcs, transactional steps + assertions)

**Jira Key:** [BK-18](https://upexgalaxy67.atlassian.net/browse/BK-18)
**Epic:** [BK-13](https://upexgalaxy67.atlassian.net/browse/BK-13) (ATC Library (Atomic Test Components))
**Priority:** Medium
**Story Points:** 5
**Status:** Ready For Dev

---

## User Story

***Source spec:*** FR-010a

## User Story

As an automation engineer or API consumer, I want a REST API to create and edit ATCs (Atomic Test Components) with their steps and assertions in a single transactional call, so that I can compose reusable test building blocks from CLI tools, scripts, and the UI client.

## Context

Anchors PRD US 4.1 and US 4.2 and implements SRS FR-010 (server surface). The UI form (Story FR-010b, BK-19) and downstream Test composition (EPIC-BK-5) both depend on this contract.

---

## QA Refinements (Shift-Left Analysis) — Added 2026-05-27

> Full ATP DRAFT lives in custom field 🧪 Acceptance Test Plan (ATP) and mirrored as a comment on this issue. This section captures the slices PO + Dev need before estimation.

### 🔍 Refined Acceptance Criteria — summary

13 Gherkin scenarios produced (Happy 2 / Negative 7 / Boundary 2 / Integration 2). Key contract decisions:

1. ***Slug format***: `{module-slug}/atc-{id-first-8-chars}` (lowercase UUID prefix) — deterministic, no sequence dependency.
2. ***PATCH semantics***: Full-replace body (PUT-like), NOT partial merge. Omitted = cleared.
3. ***Version conflict***: Optimistic locking via `If-Match: <version>` header. 409 on mismatch.
4. ***Error codes***: Add `ac*outside*user*story`, `module*outside*project*subtree`, `steps*position*invalid` to API*ERROR*CODES map.
5. ***Auth***: `requireBearerToken` + `requireScope('atc:write')` on both endpoints.
6. `bunkai*create*atc`*** RPC***: NEW RPC returning uuid (separate from `bunkai*save*atc` which is UPDATE-only).
7. ***affected*************test*************ids***: Empty array in MVP (`test_steps` table does not exist yet).
8. ***user*************story*************id on PATCH***: Immutable — silently ignored if provided.

### ⚠️ Edge Cases Identified

14 edge cases: 6 High, 5 Medium, 3 Low. Top high-severity:

- POST with invalid PAT (401), insufficient scope (403), PATCH to non-existent (404)
- Concurrent PATCH version conflict (409), slug collision (409)
- POST with module outside project subtree

### ❓ Open Questions — with Senior PO/DEV decisions

1. ***Slug collision handling***: Return 409 — client must retry with different module/title. (Senior PO)
2. ***Event consumers MVP***: Log to event_log table — BK-20/21 consume later. (Senior PO)
3. ***Scope naming***: Single `atc:write` covers both POST and PATCH. (Senior PO)
4. ***bunkai*************create*************atc signature***: Returns uuid, takes p*project*id. Slug computed in PL/pgSQL. (Senior DEV)
5. ***Error code registration***: Add to API*ERROR*CODES map (not inline). (Senior DEV)
6. ***affected*************test*************ids***: Empty [] — test_steps table not yet migrated. (Senior DEV)
7. ***PATCH empty body***: Accept as no-op → 200, no version bump, no event. (Senior DEV)

### 📐 Scope — IN vs OUT

***IN***: POST/PATCH endpoints, bunkai*create*atc RPC, cross-entity validation, slug computation, version bump, auth+scope, optimistic locking, event emission, new error codes, OpenAPI spec, integration tests.
***OUT***: GET (BK-20), DELETE (future), UI form (BK-19), used*in expansion (BK-20), idempotency (future), webhooks (future), granular scopes (future), affected*test_ids with real data (EPIC-BK-5).

---

## Acceptance Criteria

```gherkin
Scenario: Create ATC with valid payload
Given an authenticated member of the workspace
And a User Story US-100 in module M-10 with acceptance criteria AC-1 and AC-2
When the user POSTs to /atcs with title "Login with valid email", module*id M-10, user*story*id US-100, acceptance*criterion_ids [AC-1], layer "UI", and 3 steps plus 2 assertions
Then the API returns 201 with the new ATC, its steps, and its assertions
And the slug is "{module-slug}/{atc-id-padded}"
And an atc.created event is emitted

Scenario: Reject ATC when acceptance criteria belong to a different user story
Given an authenticated member
And AC-9 belongs to user story US-200 (not US-100)
When the user POSTs /atcs with user*story*id US-100 and acceptance*criterion*ids [AC-9]
Then the API returns 422 with error code "ac*outside*user_story"
And no row is inserted in atcs, atc*steps, or atc*assertions

Scenario: Reject ATC when module is not in the user story's project subtree
Given a User Story US-100 belongs to project P-1
And module M-99 belongs to project P-2
When the user POSTs /atcs with user*story*id US-100 and module_id M-99
Then the API returns 422 with error code "module*outside*project_subtree"

Scenario: Step positions must be strictly increasing from 1
Given an authenticated member
When the user POSTs /atcs with steps positions [1, 3, 2]
Then the API returns 422 with error code "steps*position*invalid"
And the response body lists the offending positions

Scenario: PATCH /atcs/{id} updates fields and cascade-replaces steps and assertions atomically
Given an existing ATC at version 1 with 3 steps and 1 assertion
When the user PATCHes /atcs/{id} with a new title and a replacement steps array of 2 steps
Then the API returns 200 with version 2
And the old steps and assertions are deleted in the same transaction as the new inserts
And an atc.updated event is emitted with affected*test*ids
```

---

## Business Rules

- acceptance*criterion*ids[] must all belong to the supplied user*story*id (cross-entity check)

- module_id must equal the user story's module OR be a descendant module within the same project (subtree check)

- layer must be one of {UI, API, Unit} — enum constraint at DB and API level

- steps[] positions must be integers, strictly increasing, starting at 1

- tags[] max length is 10; title length 3..200 chars; step content max 2KB Markdown

- slug is computed once on create and is immutable across edits (renames do not change slug)

- version integer is monotonically increasing per ATC; PATCH increments by 1

---

## Scope

- POST /atcs endpoint with full body validation (title, module*id, user*story_id, AC ids, layer, steps[], assertions[], tags[])

- PATCH /atcs/{id} endpoint with partial update + cascade replace of steps/assertions

- Transactional insert/update of atcs + atc*steps + atc*assertions tables

- Slug computation "{module-slug}/{atc-id-padded}"

- Cross-entity validation (AC belongs to US, module in project subtree, layer enum, step positions)

- Event emission: atc.created on POST, atc.updated on PATCH (with affected*test*ids count)

- OpenAPI spec entries for both endpoints with request/response schemas

- Unit + integration tests (cross-entity rules, transaction rollback on failure)

---

## Workflow

A member calls POST /atcs with a fully-formed payload. The API layer validates schema (zod/openapi) then performs cross-entity checks against user*stories, acceptance*criteria, and modules tables. Inside a single SQL transaction the service inserts the atcs row, then bulk-inserts atc*steps and atc*assertions referencing the new atc*id, then computes and persists the slug. On commit the event bus emits atc.created with the full payload. PATCH /atcs/{id} follows the same path but starts by loading the current row, applies the partial update, deletes-then-inserts steps and assertions in the same transaction, increments version, and emits atc.updated with the list of test*ids that reference this ATC.

---

## Definition of Done

- [ ] Implementation complete
- [ ] Unit tests written
- [ ] Code reviewed
- [ ] Documentation updated

---

## Metadata

- **Created:** 5/20/2026
- **Updated:** 5/27/2026
- **Reporter:** Ely
- **Assignee:** Ely
- **Labels:** api, atc, backend, mvp, shift-left-2026-05-27, shift-left-reviewed, wave-2

---

_Synced from Jira by sync-jira-issues_
_Last sync: 2026-05-28T08:58:37.885Z_
