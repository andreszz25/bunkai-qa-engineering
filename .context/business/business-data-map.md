```
+==============================================================+
|  BUNKAI TMS -- Business Data Map                             |
|  Integrated Quality Lifecycle -- ATC Management System       |
+==============================================================+
Generated: 2026-05-25 | Source: /project-discovery Phase 1+3
```

---

## 1. Executive Summary

Bunkai TMS solves a gap felt by QA teams working on modern software products: the broken chain between backlog stories, acceptance criteria, and the actual test cases that verify them. Existing test management tools are either enterprise-heavy and disconnected from code (Zephyr, TestRail) or purely test-execution trackers with no traceability back to business requirements. Bunkai implements the **IQL (Integrated Quality Lifecycle)** methodology, which treats the story → AC → ATC pipeline as a first-class data model enforced at the database level, not just as documentation convention.

The system is built for three types of consumers operating on the same data: **QA engineers** authoring and managing ATCs through the web application, **AI agents and CLI tools** reading and updating test status via bearer-token (PAT) authentication, and **development team members** creating the user stories and acceptance criteria that ATCs must trace back to. All three consumers share the same Supabase Postgres schema under row-level security, so workspace isolation is a structural guarantee, not an application convention.

Bunkai is multi-tenant (workspace-scoped), open-source (Apache-2.0), and designed to run both on cloud (Vercel + Supabase managed) and self-hosted (docker compose, planned). The PAT system with scoped permissions (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`) is the primary integration surface for CI pipelines and agentic test runners, giving any external tool a typed, auditable API into the test lifecycle.

```
+------------------+    +------------------+    +------------------+
|   QA Engineer    |    |  Dev / PM        |    |  AI Agent / CI   |
|                  |    |  (Story Authors) |    |  (Automation)    |
|  Creates ATCs    |    | Creates Stories  |    | Executes Tests   |
|  Manages ACs     |    |   and ACs        |    | via PAT API      |
+--------+---------+    +--------+---------+    +--------+---------+
         |                       |                       |
         +-------------------+---+-------------------+---+
                             |                       |
                             v                       v
                    +------------------+    +-----------------+
                    |   Bunkai TMS     |    |  Supabase DB    |
                    |  (IQL Platform)  |    |  (RLS-gated)    |
                    +------------------+    +-----------------+
                             |
               +-------------+-------------+
               |             |             |
        +------+--+   +------+--+   +------+--+
        | Vercel  |   | Resend  |   |  Jira   |
        | (host)  |   | (email) |   | (link)  |
        +---------+   +---------+   +---------+
```

---

## 2. Entity Map

### 2.1 Entity Relationship Diagram

```
+---------------------+         +---------------------+
|      workspaces     |         |   workspace_members  |
+---------------------+         +---------------------+
| id (PK)             |1      N | workspace_id (FK)   |
| slug (unique)       +-------->+ user_id (FK)        |
| name                |         | role                |
| owner_user_id (FK)  |         | status              |
| plan                |         | joined_at           |
| created_at          |         +---------------------+
+----------+----------+
           | 1
           | N
           v
+---------------------+         +---------------------+
|       projects      |         |       modules       |
+---------------------+         +---------------------+
| id (PK)             |1      N | id (PK)             |
| workspace_id (FK)   +-------->+ project_id (FK)     |
| slug                |         | parent_module_id(FK)|<--+
| name                |         | path (unique/proj)  |   | self-ref
| description         |         | name                |   | (tree)
| created_at          |         | position            +---+
+---+-----------------+         +---+-----------------+
    |                               | 1
    | 1                             | N
    | (direct FK on atcs)           v
    |                   +-----------------------+
    |                   |      user_stories     |
    |                   +-----------------------+
    |                   | id (PK)               |
    |                   | module_id (FK)        |
    |                   | title                 |
    |                   | external_id (Jira)    |
    |                   | external_url (Jira)   |
    |                   | created_at            |
    |                   +-----------+-----------+
    |                               | 1
    |                               | N
    |                               v
    |                   +-----------------------+
    |                   | acceptance_criteria   |
    |                   +-----------------------+
    |                   | id (PK)               |
    |                   | user_story_id (FK)    |
    |                   | title                 |
    |                   | description           |
    |                   | position (unique/story|
    |                   | created_at            |
    |                   +-----------+-----------+
    |                               | M (via M:N)
    |                               |
    |        +----------------------+
    |        |
    |  N     v
    +------->+---------------------+
             |         atcs        |
             +---------------------+
             | id (PK)             |
             | project_id (FK)     |
             | module_id (FK)      |
             | user_story_id (FK)  |
             | slug (unique/proj)  |
             | title               |
             | layer (UI|API|Unit) |
             | version (opt.lock)  |
             | status              |
             | tags (text[])       |
             | tsv (FTS index)     |
             | created_at          |
             | updated_at          |
             +--+--+--+------------+
                |  |  |
       +--------+  |  +----------+
       |           |             |
       v           v             v
+----------+ +----------+ +-----------------------+
| atc_steps| |atc_assert| | atc_acceptance_criteri|
+----------+ +----------+ | a (M:N junction)      |
| id (PK)  | | id (PK)  | +-----------------------+
| atc_id   | | atc_id   | | atc_id (FK)           |
| position | | position | | acceptance_criterion  |
| content  | | content  | |   _id (FK)            |
| input_da | +----------+ +-----------------------+
| expected |   (THE ANCHORING MOAT:
+----------+    ATC must have >= 1 AC link)


+------------------------------+
|       access_tokens          |
+------------------------------+
| id (PK)                      |
| user_id (FK -> auth.users)   |
| workspace_id (FK, nullable)  |
| name                         |
| token_prefix (indexed, 12ch) |
| hash (SHA-256)               |
| scopes (text[])              |
| expires_at                   |
| revoked_at (soft-delete)     |
| last_used_at                 |
| created_at                   |
+------------------------------+
```

### 2.2 Entity Table

| Entity | Business Role | Why it exists |
|--------|--------------|---------------|
| `workspaces` | Tenant boundary / team container | Multi-tenant root. Every other entity resolves to exactly one workspace. Enables team isolation under RLS without cross-workspace data leakage. |
| `workspace_members` | RBAC join — user in workspace | Decouples user identity (Supabase Auth) from workspace access. Role and status are separate axes so a user can be invited (status) but have limited read access (role=viewer) before their first action. |
| `projects` | Application Under Test (AUT) | Organizes ATCs under a logical product (e.g. "Bunkai TMS"). Slug-addressed in URLs. Scoped to one workspace. |
| `modules` | Hierarchical test folder | Self-referential tree (max depth 6) for organizing stories and ATCs within a project. Materialized path (`/auth/login`) enables efficient subtree queries without recursive CTEs at runtime. |
| `user_stories` | Business requirement unit | Anchors ATCs to a specific business intent. Optional Jira `external_id`/`external_url` creates a read-only link to the backlog without requiring Jira API access during testing. |
| `acceptance_criteria` | Testable condition on a story | Granular, sortable conditions defining when a story is complete. The unit that ATCs must reference to qualify as anchored. Position-unique per story for ordered display. |
| `atcs` | Core test case unit (ATC) | The fundamental deliverable of the IQL methodology. Carries layer classification, version counter for optimistic locking, full-text search index (GIN on tsvector), and the 6-state execution lifecycle. |
| `atc_steps` | Ordered test procedure | Describes what to do, step by step, during test execution. Fully replaced (not diffed) on every save to keep authoring simple. |
| `atc_assertions` | Expected outcomes / pass conditions | Separate from steps — defines what "pass" means after steps are executed. Enables assertion-first authoring patterns. |
| `atc_acceptance_criteria` | Traceability M:N join (anchoring moat) | Enforces that every ATC references at least one AC from its parent story. This is the structural guarantee that test cases cannot drift from business requirements. |
| `access_tokens` | PAT for CLI/AI/CI bearer auth | Long-lived, scoped bearer tokens for non-browser consumers. Secret returned once, stored as SHA-256 hash. Soft-delete-only for permanent audit trail. |

### 2.3 Relationship Narrative

**Workspace scoping** is the primary security boundary. Every RLS policy in the system ultimately resolves access by checking `workspace_members` for the calling `auth.uid()` with `status = 'active'`. The four SECURITY DEFINER helper functions (`bunkai_is_workspace_member`, `bunkai_can_write_workspace`, `bunkai_is_workspace_admin`, `bunkai_is_workspace_owner`) encapsulate these checks to avoid recursive policy evaluation.

**The story → AC → ATC traceability chain** is the IQL data spine: a User Story defines the business goal; Acceptance Criteria break it into testable conditions; ATCs prove those conditions are met. The chain runs: `module` → `user_story` → `acceptance_criteria` ← `atc_acceptance_criteria` → `atcs`. Deletion is guarded at the `user_story` → `atcs` FK with `ON DELETE RESTRICT` — you cannot remove a story that has ATCs, preventing orphaned test cases.

**The anchoring moat** is the `atc_acceptance_criteria` M:N table. An ATC without any rows in this table is considered incomplete. This constraint is enforced at the application layer in the current MVP (the `saveAtcAction` Server Action returns an error if `acIds.length === 0`), making it a hard gate before the `bunkai_save_atc` RPC is ever called.

**PAT scoping** allows fine-grained API access control. A token with only `atc:read` cannot mutate anything; `run:execute` is the scope reserved for external tools updating ATC status after a test run; `workspace:admin` is for tools that need to manage workspace-level resources. The `token_prefix` index enables O(1) lookup before the constant-time SHA-256 hash comparison.

---

## 3. Business Flows

### Flow 1: User Onboarding (Magic Link Auth)

```
User submits email on /login
        |
        v
POST /api/v1/auth/magic-link  { email, next? }
        |
        v
Supabase Auth generates OTP code
        |
        v (via Resend)
User inbox receives magic link email
  URL: /auth/callback?code=<otp>&next=<path>
        |
        v
User clicks email link
        |
        v
GET /auth/callback?code=<otp>&next=<path>
        |
        +-- code missing? --> redirect /login?error=missing_code
        |
        v
supabase.auth.exchangeCodeForSession(code)
        |
        +-- exchange failed? --> redirect /login?error=otp_exchange_failed&reason=...
        |
        v
Session stored as HttpOnly SSR cookie (@supabase/ssr)
        |
        v
Redirect to safeNext (/projects or custom path)
        |
        v
middleware.ts evaluates /projects as PROTECTED
  --> supabase.auth.getUser() confirms session valid
  --> pass through to /projects
```

**Steps:**
1. User navigates to `/login` and submits email via `magic-link-form.tsx`
2. `POST /api/v1/auth/magic-link` called with `{ email, next?: string }`
3. Server calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })`
4. Supabase Auth sends OTP email via Resend (configured in Supabase dashboard)
5. User clicks the email link — browser hits `GET /auth/callback?code=<otp>&next=<path>`
6. `auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`
7. On success: session cookie set, user redirected to `safeNext`
8. On every subsequent request: `middleware.ts` calls `supabase.auth.getUser()` to refresh and validate session

**Business rules:**
- `next` parameter must be root-relative (`/` prefix, not `//` — open-redirect guard enforced in both `magic-link/route.ts` AND `callback/route.ts`)
- Default redirect after auth: `/projects`
- Supabase rate-limits (HTTP 429) are forwarded as `rate_limited` error codes
- Link expiry and already-used enforcement is handled by Supabase Auth internally (app surfaces the error via `otp_exchange_failed` redirect)

**Code:** `app/api/v1/auth/magic-link/route.ts`, `app/auth/callback/route.ts`, `middleware.ts`

---

### Flow 2: Workspace + Project Setup (New User Onboarding)

```
User authenticated --> redirect /projects
        |
        v
/projects page checks workspace_members
  No active memberships?
        |
        v
Redirect to /onboarding
        |
        v
OnboardingPage (server): checks user + memberships
  Already has workspace? --> redirect /projects
        |
        v
OnboardingForm (client): user enters workspace name
  Auto-slugified: "My Team QA" --> "my-team-qa"
  User can override slug manually
        |
        v
Form submit --> bootstrapWorkspace(supabase, { slug, name })
        |
        v
Supabase RPC: bunkai_bootstrap_workspace(p_slug, p_name)
  SECURITY DEFINER (bypasses RLS for atomic creation)
  +--> INSERT workspaces { slug, name, owner_user_id, plan:'community' }
  +--> INSERT workspace_members { workspace_id, user_id, role:'owner', status:'active' }
  Both in same transaction -- rolls back as unit on failure
        |
        +-- slug collision (SQLSTATE 23505)?
        |   toast.error("Slug taken -- try another")
        |
        v
Workspace created --> router.replace('/projects')
        |
        v
User can now create projects within the workspace
```

**Steps:**
1. New authenticated user has no workspace membership
2. `/onboarding` page renders `OnboardingForm` with user email
3. User types workspace name — slug auto-generated via `slugify()` (lowercase, hyphens)
4. On submit: client calls `bunkai_bootstrap_workspace` RPC
5. RPC atomically creates `workspaces` row + `workspace_members` row (owner/active)
6. On success: redirect to `/projects`
7. On slug collision: user-friendly error toast, stays on form

**Business rules:**
- Slug format: `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$` (validated in both client and RPC)
- New workspace always starts with `plan: 'community'`
- Caller is automatically the workspace owner (both RPC and RLS enforce `auth.uid() = owner_user_id`)
- Cannot use existing slug — no silent coalescing (URL ambiguity risk)

**Code:** `app/(app)/onboarding/page.tsx`, `app/(app)/onboarding/onboarding-form.tsx`, `supabase/migrations/0006_bootstrap_workspace.sql`, `lib/supabase/rpc.ts`

---

### Flow 3: Story + AC Authoring

```
QA/PM in project view
        |
        v
Navigate to module in module tree
        |
        v
Create user story (optional Jira link)
  POST user_stories { module_id, title, description?, external_id?, external_url? }
        |
        v
Story created --> add acceptance criteria
  POST acceptance_criteria { user_story_id, title, description?, position }
  UNIQUE (user_story_id, position) -- sort-order constraint
        |
        v
Reorder ACs (drag-and-drop or arrow keys)
  PATCH acceptance_criteria SET position = <new_position>
  Positions are 0-indexed, unique per story
        |
        v
Story with N ACs is ready to be referenced by ATCs
```

**Data flow:**

```
Story (external_id: "BK-42") 
  --> AC-0: "Login button is visible"
  --> AC-1: "Magic link email is sent within 5s"
  --> AC-2: "Valid OTP redirects to /projects"
```

**Business rules:**
- `external_id` and `external_url` are optional — Jira link is a convenience, not a requirement
- Bunkai stores the Jira reference read-only — it does NOT push updates to Jira
- `position` is unique per story (`UNIQUE (user_story_id, position)`) — reordering requires position updates
- Deletion of a story with ATCs is blocked (`ON DELETE RESTRICT` on `atcs.user_story_id`)
- Cascades: deleting a story cascades to its ACs; deleting a module cascades to its stories

**Code:** `supabase/migrations/0003_authoring.sql`

---

### Flow 4: ATC Creation + Anchoring (The Core Flow)

```
QA selects project/module/story
        |
        v
Create ATC shell
  INSERT atcs { project_id, module_id, user_story_id, slug, title, layer, status:'unrun', version:1 }
        |
        v
Open ATC editor (Monaco-based)
  +-- Edit title, layer (UI/API/Unit), tags
  +-- Write steps (Markdown format, parsed by parseStepsMarkdown)
  +-- Write assertions (YAML format, parsed by parseAssertionsYaml)
  +-- Select AC links (>= 1 required from parent story)
        |
        v
User clicks Save
        |
        v
saveAtcAction (Server Action) validates:
  +-- userStoryId present?  No  --> "Bind to a user story before saving."
  +-- acIds.length > 0?     No  --> "Bind at least one acceptance criterion."
  +-- title non-empty?      No  --> "Title is required."
        |
        v (all validations pass)
Calls bunkai_save_atc RPC (SECURITY INVOKER):
  +-- UPDATE atcs SET title, layer, tags, user_story_id, version = version+1, updated_at = now()
  +-- DELETE atc_steps WHERE atc_id = p_atc_id
  +-- INSERT atc_steps (full ordered list from p_steps JSON array)
  +-- DELETE atc_assertions WHERE atc_id = p_atc_id
  +-- INSERT atc_assertions (full ordered list from p_assertions JSON array)
  +-- DELETE atc_acceptance_criteria WHERE atc_id = p_atc_id
  +-- INSERT atc_acceptance_criteria for each ac_id in p_ac_ids
  All in ONE transaction -- rolls back atomically on failure
        |
        v
revalidatePath() triggers Next.js cache invalidation
ATC editor displays version N+1
```

**Business rules:**
- ATC cannot be saved without at least one AC link — the anchoring moat
- Every save increments `version` (optimistic locking handle for Phase E if-match)
- Steps and assertions are fully replaced (not merged) — position order comes from the JSON array index
- `bunkai_save_atc` is `SECURITY INVOKER` — RLS policies of the calling user still apply
- `atcs_refresh_tsv` trigger fires on INSERT/UPDATE of `title` or `tags` — full-text search index is always current
- `atcs_set_updated_at` trigger fires on any UPDATE — `updated_at` is always current

**ATC save single-transaction guarantee:**

```
BEGIN
  UPDATE atcs              (version++)
  DELETE atc_steps
  INSERT atc_steps[]
  DELETE atc_assertions
  INSERT atc_assertions[]
  DELETE atc_acceptance_criteria
  INSERT atc_acceptance_criteria[]
COMMIT (or ROLLBACK on any failure)
```

**Code:** `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts`, `supabase/migrations/0007_save_atc.sql`, `supabase/migrations/0004_atcs.sql`, `lib/supabase/rpc.ts`

---

### Flow 5: Module Tree Management

```
Project created
        |
        v
Create root module
  INSERT modules { project_id, parent_module_id: NULL, path: 'auth', name: 'Auth', position: 0 }
        |
        v
Create child module (depth 2)
  INSERT modules { project_id, parent_module_id: <root.id>, path: 'auth/login', name: 'Login', position: 0 }
        |
        v
Create grandchild (depth 3)
  INSERT modules { project_id, parent_module_id: <child.id>, path: 'auth/login/magic-link', ... }
        |
        v (max depth = 6 enforced by CHECK constraint)
  INSERT modules with path depth 7? --> PostgreSQL CHECK fails
  array_length(string_to_array('a/b/c/d/e/f/g', '/'), 1) = 7 > 6 --> ERROR

Tree structure:
  [Project]
    +-- [Module] auth (path: 'auth')
    |     +-- [Module] login (path: 'auth/login')
    |     |     +-- [Module] magic-link (path: 'auth/login/magic-link')
    |     +-- [Module] logout (path: 'auth/logout')
    +-- [Module] projects (path: 'projects')
          +-- [Module] create (path: 'projects/create')
```

**Business rules:**
- `path` is slash-delimited materialized path — unique per project
- Max depth 6: `CHECK (array_length(string_to_array(path, '/'), 1) BETWEEN 1 AND 6)`
- `position` controls sibling sort order — no uniqueness constraint on position (siblings can be reordered freely)
- Deleting a module cascades to child modules, child stories, and child ATCs
- Stories and ATCs both belong to a module (`module_id` FK)

**Code:** `supabase/migrations/0002_projects_modules.sql`

---

### Flow 6: PAT Issuance + API Access

```
Authenticated user in Settings
        |
        v
POST /api/v1/tokens
  Body: { scopes: ['atc:read', 'run:execute'], name?: string, workspace_id?: uuid, expires_in_days?: number }
        |
        v
Session validated (cookie auth only -- PATs cannot create PATs)
        |
        v
Server generates:
  secret = 32 random bytes (base64url, ~256 bits entropy)
  tokenPrefix = secret.slice(0, 12)  -- first 12 chars
  hash = SHA-256(secret)             -- stored in DB
  fullToken = "bk_pat_" + tokenPrefix + "." + secret.slice(12)
        |
        v
INSERT access_tokens {
  user_id, workspace_id, name, token_prefix, hash, scopes, expires_at
}
        |
        v
Response (HTTP 201):
  { id, token: "bk_pat_<prefix>.<secret>", name, scopes, expires_at, ... }
  WARNING: "Store this token now -- it cannot be retrieved later."
  (token field NEVER returned again after this response)

------

API call with PAT:
  GET /api/v1/... + Authorization: Bearer bk_pat_<prefix>.<secret>
        |
        v
requireBearerToken() in lib/api/middleware/bearer.ts:
  1. Parse header -- strip "Bearer " prefix
  2. Verify "bk_pat_" family prefix
  3. Split on "." to get prefix (12ch) + secret remainder
  4. SELECT access_tokens WHERE token_prefix = <prefix> LIMIT 5 (indexed)
  5. For each candidate: SHA-256(secret) == row.hash?
  6. revoked_at IS NULL? expires_at > now?
  7. First match wins --> return BearerContext { userId, workspaceId, scopes, tokenId }
  8. Fire-and-forget: UPDATE access_tokens SET last_used_at = now()
        |
  (no match? uniform 401 -- never leak which check failed)
        |
        v
requireScope(ctx, 'atc:read') -- 403 if scope missing
        |
        v
Route handler executes with userId + workspaceId context

------

Token revocation:
  DELETE /api/v1/tokens/<uuid>   (session-authenticated)
        |
        v
  UPDATE access_tokens SET revoked_at = now() WHERE id = <uuid> AND revoked_at IS NULL
  Returns 204 on success, 404 if not found or already revoked
  Row is NEVER hard-deleted -- audit trail preserved indefinitely
```

**Business rules:**
- PATs can only be issued by authenticated browser sessions (cookie auth) -- prevents token-to-token escalation
- `token_prefix` is indexed for O(1) lookup -- hash compare is the expensive part, done after prefix match
- All failures return the same 401 -- no information leakage about which validation step failed
- Revocation is permanent soft-delete: `revoked_at` set, row kept, no hard DELETE RLS policy exists
- Global tokens (`workspace_id = NULL`) can span workspaces; workspace-scoped tokens constrain future rate limiting and auditing
- `last_used_at` updated fire-and-forget -- auth never fails because of the log write

**Code:** `app/api/v1/tokens/route.ts`, `app/api/v1/tokens/[id]/route.ts`, `lib/api/middleware/bearer.ts`, `supabase/migrations/0008_access_tokens.sql`

---

### Flow 7: Test Execution (External/CLI -- Planned)

```
External tool (CI pipeline, AI agent, CLI)
        |
        v
Authenticate via PAT (see Flow 6)
  Required scope: atc:read (to read ATCs)
        |
        v
GET /api/v1/... (atc:read scope)
  Read ATCs for a project/module
  --> Returns ATC list: { id, slug, title, layer, status, steps[], assertions[], acIds[] }
        |
        v
Execute test externally (Playwright, Postman, custom runner)
        |
        v
Report result back via PAT (run:execute scope)
  [ENDPOINT NOT YET IMPLEMENTED -- Discovery Gap]
  Expected: PATCH /api/v1/atcs/<id>/status
  Body: { status: 'pass' | 'fail' | 'blocked' | 'skipped' }
        |
        v
ATC status updated in DB
  [No `runs` or `test_executions` table exists yet]
  Current schema: status lives directly on `atcs` row
```

**Discovery Gap:** The `run:execute` PAT scope exists and is validated in `bearer.ts`, but no endpoint exists that accepts it. There is no `runs` or `test_executions` table in any migration. External execution status updates are a planned feature without a current implementation path.

**Code (partial):** `supabase/migrations/0008_access_tokens.sql` (scope definition), `lib/api/middleware/bearer.ts` (scope checking), `supabase/migrations/0004_atcs.sql` (status column on `atcs`)

---

## 4. State Machines

### 4.1 ATC Status State Machine

```
                    ATC Created
                        |
                        v
                    [unrun]
                    /  |  \
         start-run /   |   \ (no direct transitions)
                  /    |    \
                 v     |     \
            [running]  |      |
           /  |  |  \  |      |
     pass /   |  |   \ |reset |
          v   |  |    v|      |
         [pass]  |   [fail]   |
           |   fail |   |     |
           |     v  |   |     |
           |  [fail]|   |     |
           |        |   |     |
      +----+--------+---+--+--+
      |    block    |  skip   |
      v             v         v
  [blocked]     [fail]    [skipped]
      |                       |
      +-----> reset <----------+
                  |
                  v
              [unrun]
```

Full transition table:

| From | To | Triggering Event | Effects | Notes |
|------|----|-----------------|---------|-------|
| `unrun` | `running` | Execution started | `status = 'running'` | Entry point for any run |
| `running` | `pass` | Test passed | `status = 'pass'`, `updated_at` refreshed | Triggers `bunkai_set_updated_at` |
| `running` | `fail` | Test failed | `status = 'fail'`, `updated_at` refreshed | |
| `running` | `blocked` | Blocker encountered | `status = 'blocked'`, `updated_at` refreshed | |
| `running` | `skipped` | Test skipped | `status = 'skipped'`, `updated_at` refreshed | |
| `pass` | `unrun` | Reset for re-run | `status = 'unrun'` | Manual reset |
| `fail` | `unrun` | Reset for re-run | `status = 'unrun'` | After bug fix |
| `blocked` | `unrun` | Blocker resolved | `status = 'unrun'` | |
| `skipped` | `unrun` | Reset | `status = 'unrun'` | |
| `pass` | `running` | Re-execute | `status = 'running'` | Regression re-run |
| `fail` | `running` | Re-execute | `status = 'running'` | Verify fix |

**Code:** `supabase/migrations/0004_atcs.sql` (CHECK constraint), `lib/types.ts` (AtcStatus type)

---

### 4.2 WorkspaceMember Status State Machine

```
Admin sends invite
        |
        v
    [invited]
      /   \
accept/     \(admin revokes/expires)
      v       v
  [active]  [suspended]
      |
      v (admin action)
  [suspended]
      |
      v (admin reactivates)
  [active]
```

| From | To | Triggering Event | By Whom |
|------|----|-----------------|---------|
| (new) | `invited` | Admin sends invite | admin or owner |
| `invited` | `active` | User accepts invite | user (self-acceptance) |
| `invited` | `suspended` | Admin revokes invite before acceptance | admin or owner |
| `active` | `suspended` | Admin suspends member | admin or owner |
| `suspended` | `active` | Admin reactivates | admin or owner |

**Notes:** No self-service suspension. `viewer` role users have `active` status but read-only RLS.

**Code:** `supabase/migrations/0001_tenancy.sql` (CHECK constraint), `lib/types.ts` (MemberStatus)

---

### 4.3 PAT Lifecycle State Machine

```
POST /api/v1/tokens (session auth)
        |
        v
    [active]
      /   \
      |    \
expires_at  revoke (DELETE /api/v1/tokens/<id>)
< now()      |
      \       v
       \   [revoked (soft-delete)]
        |         |
        v         |
    [expired]     | (no hard DELETE -- audit trail)
        |         |
        +----+----+
             |
             v
     (row persists forever in DB)
     bearer middleware rejects silently (uniform 401)
```

| From | To | Triggering Event | Mechanism |
|------|----|-----------------|-----------|
| (new) | `active` | `POST /api/v1/tokens` | INSERT row, secret returned once |
| `active` | `expired` | `expires_at < now()` | Time-based, no DB write needed |
| `active` | `revoked` | `DELETE /api/v1/tokens/<id>` | `UPDATE SET revoked_at = now()` |
| `expired` / `revoked` | (terminal) | n/a | Row stays, no further transitions |

**Code:** `supabase/migrations/0008_access_tokens.sql`, `app/api/v1/tokens/route.ts`, `app/api/v1/tokens/[id]/route.ts`, `lib/api/middleware/bearer.ts`

---

## 5. Automatic Processes

### 5.1 DB Triggers

| Trigger Name | Table | Event | Action | Why It Exists |
|---|---|---|---|---|
| `atcs_set_updated_at` | `public.atcs` | `BEFORE UPDATE` | Calls `bunkai_set_updated_at()` — sets `new.updated_at = now()` | Keeps `updated_at` always current without app-layer responsibility |
| `atcs_refresh_tsv` | `public.atcs` | `BEFORE INSERT OR UPDATE OF title, tags` | Calls `bunkai_atcs_refresh_tsv()` — rebuilds `tsv = to_tsvector('english', title || tags)` | Maintains the GIN full-text search index automatically when title or tags change |

**Trigger functions (defined in `0004_atcs.sql`):**
- `bunkai_set_updated_at()` — generic updated_at setter, reusable for other tables in future
- `bunkai_atcs_refresh_tsv()` — ATC-specific; concatenates title + array_to_string(tags, ' ') for English-language FTS

**Source:** `supabase/migrations/0004_atcs.sql`

---

### 5.2 Cron Jobs

No `pg_cron` extensions or scheduled jobs detected in any of the 8 migration files.

**Discovery Gap (LOW):** If Supabase-level scheduled jobs exist (configured via Supabase dashboard rather than migrations), they would not appear here. Expected candidates: token expiry cleanup, FTS index maintenance, workspace usage metrics.

---

### 5.3 Webhooks (Incoming)

No webhook receiver endpoints found in `app/api/v1/`. The only non-CRUD API routes are:

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/v1/health` | GET | Liveness probe |
| `POST /api/v1/auth/magic-link` | POST | Auth initiation |
| `GET /auth/callback` | GET | OTP exchange (Supabase redirect) |
| `POST /api/v1/tokens` | POST | PAT issuance |
| `GET /api/v1/tokens` | GET | List caller PATs |
| `DELETE /api/v1/tokens/[id]` | DELETE | Soft-revoke PAT |
| `GET /api/openapi` | GET | OpenAPI JSON spec |
| `GET /api/docs` | GET | Scalar API reference UI |

**Discovery Gap (MEDIUM):** `N8N_API_URL` and `N8N_API_KEY` env vars are present. n8n typically acts as a workflow automation hub and may send webhook calls TO Bunkai or receive calls FROM Bunkai. No n8n webhook receiver endpoint exists in current code — purpose remains unknown.

---

## 6. External Integrations

### 6.1 Supabase Auth (Magic Link)

```
Browser                          Supabase Auth                Resend (email)
   |                                   |                           |
   |-- POST /api/v1/auth/magic-link --> |                           |
   |   { email, next? }                |                           |
   |                                   |-- sends OTP email via --> |
   |                                   |   emailRedirectTo:        |
   |                                   |   /auth/callback?next=... |
   |                                   |                           |
   | <-- { ok: true }                  |                    User inbox
   |                                                              |
   |  User clicks link in email                                   |
   |                                                              |
   |-- GET /auth/callback?code=<otp>&next=<path> <---------------+
   |                 |
   |   supabase.auth.exchangeCodeForSession(code)
   |                 |
   |   Session = HttpOnly cookie (@supabase/ssr)
   |                 |
   +<-- redirect --> |safeNext (/projects or /onboarding)
```

**Session management:**
- `@supabase/ssr` writes the session as an HttpOnly cookie
- `middleware.ts` calls `supabase.auth.getUser()` on EVERY request to refresh the session token
- Protected prefixes: `/projects`, `/onboarding` — redirects to `/login?next=<path>` if no session
- Public prefixes: `/login`, `/auth`, `/api/auth` — pass through without auth check

**Source:** `middleware.ts`, `app/auth/callback/route.ts`, `app/api/v1/auth/magic-link/route.ts`

---

### 6.2 Jira / Atlassian Integration

```
User Story in Bunkai
  +-- external_id: "BK-42"
  +-- external_url: "https://upexgalaxy67.atlassian.net/browse/BK-42"

(Read-only soft link -- Bunkai does NOT push to Jira, does NOT poll Jira)
(The link is display-only: clicking external_url opens Jira in a new tab)
```

**Integration type:** One-way reference storage. Bunkai stores the Jira issue key and URL as plain text columns on `user_stories`. There is no Jira API call during normal operation. The `ATLASSIAN_*` env vars in `.env.example` are for the **QA engineering toolchain** (the `bunkai-qa-engineering` repo's CLI tools for syncing Jira issues), NOT for the Bunkai TMS application itself.

**Source:** `supabase/migrations/0003_authoring.sql` (`external_id`, `external_url` columns)

---

### 6.3 Resend Email

```
POST /api/v1/auth/magic-link
        |
        v
supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
        |
        v
Supabase Auth internal --> Resend API (RESEND_API_KEY configured in Supabase dashboard)
        |
        v
Transactional email delivered to user inbox
```

**Notes:**
- Resend is invoked by Supabase Auth, not directly by the Next.js app
- `RESEND_API_KEY` is configured in the Supabase project settings (email provider), not in `lib/env.ts`
- Sender address/domain is configured in the Resend dashboard or Supabase email templates — not an env var
- Rate limiting: Supabase Auth returns HTTP 429 on rate limit; app forwards as `rate_limited` error code

---

### 6.4 n8n (Unknown Purpose)

```
Env vars present in .env.example:
  N8N_API_URL = https://n8n.example.com/api/v1
  N8N_API_KEY = <alphanumeric>

Zero usage found in any app code during discovery.
```

**Discovery Gap (MEDIUM):** n8n is a workflow automation platform. Typical uses in a TMS context: automated notifications on ATC status changes, Slack/email alerts on test failures, scheduled report generation, or webhook relay. No n8n API calls or webhook receivers exist in the current codebase.

---

### 6.5 Vercel

```
[GitHub Push / PR]
        |
        v
Vercel build triggered (bunx next build)
        |
        v
Next.js serverless functions deployed
  Production: https://upexbunkai.vercel.app
  Preview (PR): https://staging-upexbunkai.vercel.app (or auto-generated)
        |
        v
VERCEL_ENV env var available at runtime:
  'production'  --> getEnvironment() returns 'production'
  'preview'     --> getEnvironment() returns 'staging'
  (absent)      --> getEnvironment() returns 'local'
```

**Environment detection:** `lib/urls.ts` uses `process.env.VERCEL_ENV` to determine the base URL for redirects and API server definitions in OpenAPI. This is the single source of truth for environment-aware URLs in server-side code.

**Source:** `lib/urls.ts`, `.agents/project.yaml` (`webapp_domain`, environments)

---

## 7. Discovery Gaps

Items organized by testing and implementation priority:

### HIGH Priority

| Gap | Impact | Details |
|-----|--------|---------|
| No `runs` / `test_executions` table | Blocking for full IQL lifecycle | `run:execute` PAT scope exists and is validated in `bearer.ts`, but no endpoint accepts it and no DB table stores execution records. The `atcs.status` column is mutated directly. Test execution history is not tracked. |
| No CI/CD pipeline in repo | Cannot validate production deployments | No `.github/workflows/` files found. Vercel deployment is triggered by Git push but no automated test gate exists. |

### MEDIUM Priority

| Gap | Impact | Details |
|-----|--------|---------|
| n8n integration purpose unknown | Unknown automation surface | `N8N_API_URL`, `N8N_API_KEY` in `.env.example`; zero usage in any `app/` or `lib/` file. Could be for notifications, reporting, or webhook relay. |
| No `data-testid` attributes on UI | Playwright test locator strategy | UI components use Tailwind/Radix primitives without `data-testid` attributes. Playwright tests will need to rely on ARIA roles, text content, or establish a `data-testid` convention via `/adapt-framework`. |
| Magic link auth test strategy | E2E test setup complexity | No password auth fallback. Playwright fixtures need a session injection strategy (exchange Supabase service-role key for a session, or use `supabase.auth.admin.generateLink()` in test setup). |
| Monaco Editor testability | Shadow DOM complexity | `@monaco-editor/react` 4.7 renders inside a Shadow DOM. Playwright `page.fill()` does not work directly — requires `evaluate()` to access the editor's internal API or shadow DOM piercing. |
| Magic link rate limiting absent | Missing security gate | `route.ts` comment: "Phase F adds real rate-limit middleware". Current: Supabase 429 forwarded verbatim. No app-level rate limiting or abuse protection. |

### LOW Priority

| Gap | Impact | Details |
|-----|--------|---------|
| Plan tier enforcement not implemented | SaaS gating absent | `workspaces.plan` enum has `community`/`cloud`/`enterprise` values. No code gates features behind plan tiers. All users get identical capabilities regardless of plan. |
| No down-migrations | Rollback is destructive | All 8 migration files are up-only. Rollback requires manual SQL or database backup restore. No `supabase/migrations/*_down.sql` pattern exists. |
| `supabase/config.toml` not committed | Local dev reproducibility | Local Supabase setup depends on CLI defaults or manual `supabase init`. No committed config means local stack configuration may drift from production. |
| `SUPABASE_PUBLISHABLE_KEY` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY` naming | Env setup confusion | `.env.example` uses the new Supabase naming (`SUPABASE_PUBLISHABLE_KEY`); `lib/env.ts` validates `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` — it is authoritative. |
| No `defects` / `bugs` table | IQL lifecycle incomplete | IQL methodology includes defect linkage as a stage. No schema exists for linking ATCs to bug reports or defect tracking. |
| No docker-compose.yml for self-hosting | Self-host feature not deliverable | FEATURE_TICKS references "Self-host with one docker compose". No `docker-compose.yml` in repo root. |

---

## 8. RLS Helper Functions Reference

These SECURITY DEFINER functions are the gating primitives for all RLS policies (defined in `0005_rls_helpers.sql`):

| Function | Checks | Used By |
|----------|--------|---------|
| `bunkai_is_workspace_member(ws_id)` | `status = 'active'` | All SELECT policies |
| `bunkai_can_write_workspace(ws_id)` | `status = 'active' AND role IN ('member','admin','owner')` | All INSERT/UPDATE/DELETE policies |
| `bunkai_is_workspace_admin(ws_id)` | `status = 'active' AND role IN ('admin','owner')` | `workspace_members` mutations |
| `bunkai_is_workspace_owner(ws_id)` | `status = 'active' AND role = 'owner'` | `workspaces` UPDATE/DELETE |

**Why SECURITY DEFINER matters:** Without these helpers, RLS policies that query `workspace_members` from within a `workspace_members` RLS policy would cause infinite recursion (`42P17`). The DEFINER context bypasses RLS for the helper's internal query, breaking the cycle.

---

## 9. Full API Surface (Confirmed from Source)

| Method | Path | Auth | Purpose | Code Location |
|--------|------|------|---------|---------------|
| GET | `/api/v1/health` | None | Liveness probe — `{ ok, service, env, ts }` | `app/api/v1/health/route.ts` |
| POST | `/api/v1/auth/magic-link` | None | Send magic link OTP email | `app/api/v1/auth/magic-link/route.ts` |
| GET | `/auth/callback` | None | Exchange OTP code for session cookie | `app/auth/callback/route.ts` |
| POST | `/api/v1/tokens` | Cookie session | Issue new PAT (secret returned once) | `app/api/v1/tokens/route.ts` |
| GET | `/api/v1/tokens` | Cookie session | List caller's PATs (no secret) | `app/api/v1/tokens/route.ts` |
| DELETE | `/api/v1/tokens/[id]` | Cookie session | Soft-revoke PAT by UUID | `app/api/v1/tokens/[id]/route.ts` |
| GET | `/api/openapi` | None | OpenAPI JSON spec (runtime-generated) | `app/api/openapi/route.ts` |
| GET | `/api/docs` | None | Interactive Scalar API reference UI | `app/api/docs/page.tsx` |

**Note:** The current API surface is intentionally minimal. No REST endpoints exist for ATCs, modules, stories, or projects — all mutations go through Next.js Server Actions (which call Supabase client/RPC directly) and Supabase's PostgREST auto-generated REST API (gated by RLS). The PAT bearer middleware in `lib/api/middleware/bearer.ts` is wired up and ready but no routes currently use `requireBearerToken()` for data endpoints.

---

*Sources: `supabase/migrations/` (0001–0008), `app/api/v1/` (all route handlers), `app/auth/callback/route.ts`, `app/(app)/onboarding/`, `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts`, `middleware.ts`, `lib/api/middleware/bearer.ts`, `lib/urls.ts`, `lib/env.ts`, `.context/business/business-model.md`, `.context/business/domain-glossary.md`, `.context/infrastructure/backend.md`*
