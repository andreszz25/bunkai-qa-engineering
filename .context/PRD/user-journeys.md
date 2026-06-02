# PRD — User Journeys: Bunkai TMS

> Discovery type: Reverse-engineering from source code (read-only).
> Generated: 2026-05-28
> Source repos: `/home/andreszz25/upex/upex-bunkai-tms/`
> Every step cites Evidence (file:line). Steps with no file evidence go to Discovery Gaps.

---

## 1. Route Map

### Public Routes

| Route | Page / Handler | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Root redirect — sends all visitors to `/login` |
| `/login` | `app/(auth)/login/page.tsx` | Magic-link sign-in form; GitHub/Google OAuth (disabled, "soon") |
| `/auth/callback` | `app/auth/callback/route.ts` | OTP exchange — receives `?code=<otp>&next=<path>`, issues session cookie |
| `/api/v1/auth/magic-link` | `app/api/v1/auth/magic-link/route.ts` | POST — initiates Supabase OTP email via Resend |
| `/api/v1/health` | `app/api/v1/health/route.ts` | GET — liveness probe `{ ok, service, env, ts }` |
| `/api/openapi` | `app/api/openapi/route.ts` | GET — runtime-generated OpenAPI JSON spec |
| `/api/docs` | `app/api/docs/page.tsx` | GET — Scalar interactive API reference UI |

Source: `middleware.ts` lines 10–11: `PUBLIC_PREFIXES = ['/login', '/auth', '/api/auth']`; directory scan of `app/`.

### Protected Routes

| Route | Page | Requires | Purpose |
|---|---|---|---|
| `/onboarding` | `app/(app)/onboarding/page.tsx` | Cookie session (Supabase Auth) | Workspace creation wizard — shown to users with no active workspace membership |
| `/projects` | `app/(app)/projects/page.tsx` | Cookie session + active `workspace_members` row | Project index — redirects to first project slug or empty state |
| `/projects/[projectSlug]` | `app/(app)/projects/[projectSlug]/page.tsx` | Cookie session; RLS filters by workspace membership | Project view — ATC table + module tree sidebar |
| `/projects/[projectSlug]/atcs/[atcId]` | `app/(app)/projects/[projectSlug]/atcs/[atcId]/page.tsx` | Cookie session; ATC must belong to project in caller's workspace | ATC editor — Monaco steps, YAML assertions, anchoring panel |

Source: `middleware.ts` lines 9–10: `PROTECTED_PREFIXES = ['/projects', '/onboarding']`; `app/(app)/` directory structure.

Protected route auth guard: `middleware.ts` lines 42–47 — unauthenticated request on protected prefix → `redirect('/login?next=<pathname>')`.

### Dynamic Routes

| Pattern | Example | Purpose |
|---|---|---|
| `/projects/[projectSlug]` | `/projects/bunkai-tms` | Project identified by workspace-unique slug |
| `/projects/[projectSlug]/atcs/[atcId]` | `/projects/bunkai-tms/atcs/550e8400-e29b-41d4-a716-446655440001` | ATC editor — `atcId` is the UUID primary key |
| `/api/v1/tokens/[id]` | `/api/v1/tokens/550e8400-e29b-41d4-a716-446655440002` | PAT soft-revocation — `id` is the token UUID |

Source: `app/(app)/projects/[projectSlug]/atcs/[atcId]/page.tsx`; `app/api/v1/tokens/[id]/route.ts`.

---

## 2. Journeys

---

### J1: First-time user — Magic-link auth → Onboarding → Workspace creation

**Persona**: New user (any role) who has never logged in  
**Goal**: Authenticate and create first workspace  
**Discovered From**: `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `app/(app)/onboarding/page.tsx`, `app/(app)/onboarding/onboarding-form.tsx`, `supabase/migrations/0006_bootstrap_workspace.sql`

```mermaid
flowchart LR
    A[Visit /] --> B[Redirect to /login]
    B --> C[Enter email in MagicLinkForm]
    C --> D[POST /api/v1/auth/magic-link]
    D --> E[Supabase sends OTP email via Resend]
    E --> F[User clicks email link]
    F --> G[GET /auth/callback?code=&next=]
    G -->|code missing| H[Redirect /login?error=missing_code]
    G -->|exchange fails| I[Redirect /login?error=otp_exchange_failed]
    G -->|success| J[Session cookie set via @supabase/ssr]
    J --> K[Redirect to /projects]
    K -->|no active membership| L[Redirect to /onboarding]
    L --> M[Enter workspace name - slug auto-generated]
    M --> N[Submit form]
    N -->|slug taken 23505| O[toast.error Slug taken]
    N -->|success| P[bunkai_bootstrap_workspace RPC]
    P --> Q[workspaces + workspace_members created atomically]
    Q --> R[router.replace /projects]
    R -->|no projects yet| S[Empty state - Phase E placeholder]
```

**Step-by-Step**

| Step | Page | Action | Next | Evidence |
|---|---|---|---|---|
| 1 | `/` | Server redirect | `/login` | `app/page.tsx` line 4: `redirect('/login')` |
| 2 | `/login` | User types email into `MagicLinkForm` | POST request | `app/(auth)/login/magic-link-form.tsx` (component exists, inferred from page import) |
| 3 | `/login` | `POST /api/v1/auth/magic-link` with `{ email, next? }` | OTP email sent | `app/api/v1/auth/magic-link/route.ts` `supabase.auth.signInWithOtp` |
| 4 | Email inbox | User clicks magic link | `/auth/callback?code=<otp>&next=<path>` | `app/auth/callback/route.ts` line 7 comment |
| 5 | `/auth/callback` | `supabase.auth.exchangeCodeForSession(code)` | Session cookie set | `app/auth/callback/route.ts` line 29 `exchangeCodeForSession` |
| 6 | (middleware) | `supabase.auth.getUser()` validates session on every request | Pass-through | `middleware.ts` line 36 `supabase.auth.getUser()` |
| 7 | `/projects` | Server checks `workspace_members` for active membership | `/onboarding` (no membership) | `app/(app)/projects/page.tsx` lines 22–26 |
| 8 | `/onboarding` | Server re-checks user + memberships | Render `OnboardingForm` | `app/(app)/onboarding/page.tsx` lines 14–20 |
| 9 | `/onboarding` | User types workspace name → slug auto-generated by `slugify()` | (local state) | `app/(app)/onboarding/onboarding-form.tsx` lines 14–19 slugify function |
| 10 | `/onboarding` | Form submit → `bootstrapWorkspace(supabase, { slug, name })` | RPC call | `app/(app)/onboarding/onboarding-form.tsx` line 40 |
| 11 | `/onboarding` | `bunkai_bootstrap_workspace` RPC: INSERT workspace + member (owner/active) atomically | Success or collision | `supabase/migrations/0006_bootstrap_workspace.sql` |
| 12 | `/onboarding` | `router.replace('/projects')` | `/projects` | `app/(app)/onboarding/onboarding-form.tsx` line 53 |
| 13 | `/projects` | Has membership but no projects → empty state | User stuck (Phase E gap) | `app/(app)/projects/page.tsx` lines 44–56 |

**Error Paths**

| Error | Handling | Evidence |
|---|---|---|
| Code missing in callback URL | Redirect `/login?error=missing_code` | `app/auth/callback/route.ts` line 21 |
| OTP expired or already used | Redirect `/login?error=otp_exchange_failed&reason=<encoded>` | `app/auth/callback/route.ts` lines 27–30 |
| Open-redirect attempt in `next` param | Sanitized: `safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/projects'` | `app/auth/callback/route.ts` lines 14–15 |
| Workspace slug already taken (SQLSTATE 23505) | `toast.error('Slug "..." is taken — try another.')` | `app/(app)/onboarding/onboarding-form.tsx` lines 44–47 |
| Slug format invalid (≥3 chars, lowercase, no leading/trailing hyphen) | Inline validation message: "Slug must start and end with a letter or digit, 3–40 chars." | `app/(app)/onboarding/onboarding-form.tsx` lines 106–110 |
| Supabase OTP rate-limited (429) | Forwarded as `rate_limited` error — no app-level rate limit yet | `app/api/v1/auth/magic-link/route.ts` line 37 comment |

**Success Criteria**
- [ ] User receives magic link email after submitting valid email
- [ ] `/auth/callback` sets HttpOnly session cookie and redirects to `/projects`
- [ ] `/onboarding` renders `OnboardingForm` for user with no workspace membership
- [ ] Workspace creation inserts both `workspaces` and `workspace_members` (owner/active) atomically
- [ ] After creation, `router.replace('/projects')` executes without error
- [ ] `plan = 'community'` on newly created workspace row

---

### J2: Returning user — Login → Projects → ATC list

**Persona**: Authenticated member of an existing workspace with at least one project  
**Goal**: Log in and reach the ATC table for a project  
**Discovered From**: `app/(auth)/login/page.tsx`, `app/(app)/projects/page.tsx`, `app/(app)/projects/[projectSlug]/page.tsx`

```mermaid
flowchart LR
    A[Visit /login] --> B[Enter email]
    B --> C[POST /api/v1/auth/magic-link]
    C --> D[Click email link]
    D --> E[GET /auth/callback]
    E -->|session set| F[Redirect /projects]
    F -->|has active membership| G[Query projects in workspace]
    G -->|projects exist| H[Redirect /projects/first-slug]
    H --> I[Load project page]
    I --> J[Fetch modules + stories + ATCs + ACs in parallel]
    J --> K[Render Sidebar tree + AtcTable]
```

**Step-by-Step**

| Step | Page | Action | Next | Evidence |
|---|---|---|---|---|
| 1 | `/login` | Email submitted, magic link clicked, session set | `/projects` | J1 steps 2–6 |
| 2 | `/projects` | Server queries `workspace_members` (active) | workspace IDs list | `app/(app)/projects/page.tsx` lines 18–23 |
| 3 | `/projects` | Server queries `projects` ordered by `created_at` | first project slug | `app/(app)/projects/page.tsx` lines 27–37 |
| 4 | `/projects` | `redirect('/projects/' + projects[0].slug)` | `/projects/[projectSlug]` | `app/(app)/projects/page.tsx` line 38 |
| 5 | `/projects/[slug]` | Fetch project row, workspace row | notFound if missing | `app/(app)/projects/[projectSlug]/page.tsx` lines 18–42 |
| 6 | `/projects/[slug]` | Fetch modules, stories, ATCs, ACs in parallel | build module tree | `app/(app)/projects/[projectSlug]/page.tsx` lines 44–66 |
| 7 | `/projects/[slug]` | `buildModuleTree()` + `AtcTable` render | UI visible | `app/(app)/projects/[projectSlug]/page.tsx` lines 68–116 |

**Error Paths**

| Error | Handling | Evidence |
|---|---|---|
| Project slug not found in caller's workspace | `notFound()` → Next.js 404 page | `app/(app)/projects/[projectSlug]/page.tsx` line 33 |
| Workspace row not found | `notFound()` | `app/(app)/projects/[projectSlug]/page.tsx` line 41 |
| User has no active membership | Redirect `/onboarding` | `app/(app)/projects/page.tsx` lines 24–26 |

**Success Criteria**
- [ ] `/projects` resolves to `/projects/[firstSlug]` without flicker
- [ ] Sidebar tree renders modules, stories, ATC status dots
- [ ] `AtcTable` displays correct columns: ID, Title, Layer, Module, Status, Tags
- [ ] RLS filters ATCs to workspace the user belongs to (no cross-workspace data)

---

### J3: Member creates UserStory + AcceptanceCriteria → creates ATC → links to AC

**Persona**: QA Engineer / Developer Member (`role = 'member'`)  
**Goal**: Author a complete, anchored ATC from scratch  
**Discovered From**: `components/atcs/AtcEditor.tsx`, `components/atcs/AnchoringPanel.tsx`, `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts`, `supabase/migrations/0003_authoring.sql`, `supabase/migrations/0007_save_atc.sql`

```mermaid
flowchart LR
    A[/projects/slug ATC table] --> B[Click New ATC button]
    B --> C[ATC shell created - status: unrun, version: 1]
    C --> D[Navigate to /projects/slug/atcs/atcId]
    D --> E[ATC editor loads]
    E --> F[User types Title]
    F --> G[User selects Layer UI/API/Unit]
    G --> H[User writes Steps in Monaco Markdown editor]
    H --> I[User writes Assertions in Monaco YAML editor]
    I --> J[User adds Tags]
    J --> K[Anchoring panel: search stories by title or Jira ID]
    K --> L[Select User Story]
    L --> M[Toggle >= 1 Acceptance Criterion]
    M -->|Moat status: ENFORCED| N[Save button enabled]
    N --> O[POST saveAtcAction Server Action]
    O -->|validation pass| P[bunkai_save_atc RPC atomic transaction]
    P --> Q[ATC updated + steps/assertions/ACs fully replaced + version++]
    Q --> R[revalidatePath invalidates cache]
    R --> S[toast.success ATC saved]
    S --> T[router.refresh re-renders editor with version N+1]
```

**Step-by-Step**

| Step | Page | Action | Next | Evidence |
|---|---|---|---|---|
| 1 | `/projects/[slug]` | Click "New ATC" button | ATC shell created (UI placeholder in Phase E) | `app/(app)/projects/[projectSlug]/page.tsx` lines 95–99 button rendered |
| 2 | `/projects/[slug]/atcs/[id]` | Page loads: fetches ATC, steps, assertions, bound ACs, modules, stories, ACs | Editor hydrated | `app/(app)/projects/[projectSlug]/atcs/[atcId]/page.tsx` lines 40–67 |
| 3 | Editor | User types title in Input field | Local state update | `components/atcs/AtcEditor.tsx` line 73 `useState(atc.title)` |
| 4 | Editor | User clicks Layer button (UI/API/Unit segmented control) | `layer` state updated | `components/atcs/AtcEditor.tsx` lines 207–234 LAYERS map |
| 5 | Editor | User writes steps in Monaco (Markdown format) | `stepsMd` state updated | `components/atcs/StepEditor.tsx` loaded via `dynamic({ ssr: false })` |
| 6 | Editor | User writes assertions in Monaco (YAML format) | `assertionsYaml` state updated | `components/atcs/AtcEditor.tsx` lines 255–268 |
| 7 | Anchoring panel | User searches stories by title or Jira `external_id` | Filtered story list | `components/atcs/AnchoringPanel.tsx` lines 28–35 `useMemo` filter |
| 8 | Anchoring panel | User clicks story → `onSelectStory(id)` | `storyId` state set; `acIds` reset to `[]` | `components/atcs/AtcEditor.tsx` lines 331–334 |
| 9 | Anchoring panel | User toggles ≥1 AC checkbox | `acIds` state updated; Moat status shows "ENFORCED" | `components/atcs/AtcEditor.tsx` lines 335–338; `AnchoringPanel.tsx` lines 109–120 |
| 10 | Editor | `isAnchored = !!storyId && acIds.length >= 1` → Save button enabled | `canSave = true` | `components/atcs/AtcEditor.tsx` line 83 |
| 11 | Editor | User clicks "Save ATC" (or ⌘S) | `saveAtcAction` called | `components/atcs/AtcEditor.tsx` line 95 `handleSave` |
| 12 | Server Action | Validation: userStoryId present, acIds ≥1, title non-empty | Error return or RPC call | `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts` lines 25–33 |
| 13 | Server Action | `saveAtc(supabase, { ... })` → `bunkai_save_atc` RPC | Atomic transaction | `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts` line 36; `supabase/migrations/0007_save_atc.sql` |
| 14 | DB | `UPDATE atcs SET version = version+1`; DELETE+INSERT steps, assertions, AC links | Single transaction | `supabase/migrations/0007_save_atc.sql` |
| 15 | Server Action | `revalidatePath('/projects/[slug]/atcs/[id]')` + `revalidatePath('/projects/[slug]')` | Cache busted | `actions.ts` lines 51–52 |
| 16 | Editor | `toast.success('ATC saved')` + `router.refresh()` | UI re-renders with new version | `components/atcs/AtcEditor.tsx` line 113 |

**Error Paths**

| Error | Handling | Evidence |
|---|---|---|
| No user story selected | `toast.error('Bind to a user story before saving.')` | `actions.ts` line 26 |
| No AC selected | `toast.error('Bind at least one acceptance criterion.')` | `actions.ts` line 29 |
| Title empty | `toast.error('Title is required.')` | `actions.ts` line 33 |
| ATC not found for project | `notFound()` on page load | `app/(app)/projects/[projectSlug]/atcs/[atcId]/page.tsx` line 30 |
| RPC error from Supabase | `toast.error(error.message)` | `actions.ts` line 46; `AtcEditor.tsx` line 110 |

**Success Criteria**
- [ ] Save button disabled when no story selected or no AC checked
- [ ] Anchoring panel shows "Moat: ENFORCED" only when `storyId` set and `acIds.length >= 1`
- [ ] After successful save, `version` increments by exactly 1
- [ ] `atc_steps` and `atc_assertions` are fully replaced (old rows removed, new rows inserted)
- [ ] `atc_acceptance_criteria` rows updated to match selected `acIds`
- [ ] `updated_at` trigger fires: `atcs.updated_at = now()`
- [ ] `tsv` trigger fires: FTS index rebuilt on title + tags

---

### J4: Member edits ATC steps in Monaco editor → saves → verifies update

**Persona**: QA Engineer / Developer Member  
**Goal**: Update ATC step content and confirm the save persists  
**Discovered From**: `components/atcs/AtcEditor.tsx`, `components/atcs/StepEditor.tsx`, `lib/atc-parse.ts`

```mermaid
flowchart LR
    A[/projects/slug/atcs/id - editor loaded] --> B[Monaco editor shows steps as Markdown]
    B --> C[User edits step content]
    C --> D[setStepsMd called with new value]
    D --> E[User clicks Save ATC]
    E --> F[parseStepsMarkdown called on stepsMd string]
    F --> G[saveAtcAction - steps array sent]
    G --> H[bunkai_save_atc RPC - DELETE+INSERT atc_steps]
    H --> I[toast.success ATC saved]
    I --> J[router.refresh re-renders editor]
    J --> K[Monaco editor loads updated steps from DB]
```

**Step-by-Step**

| Step | Page | Action | Next | Evidence |
|---|---|---|---|---|
| 1 | `/projects/[slug]/atcs/[id]` | Page loads with `initialSteps` from DB | `stepsToMarkdown(initialSteps)` sets initial Monaco content | `components/atcs/AtcEditor.tsx` line 80 `useState(() => stepsToMarkdown(initialSteps))` |
| 2 | Editor | Monaco editor displays steps as numbered Markdown lines | User reads/edits | `components/atcs/StepEditor.tsx` `language="markdown"` |
| 3 | Editor | User edits step text in Monaco | `setStepsMd(newValue)` | `components/atcs/AtcEditor.tsx` line 248 `onChange={setStepsMd}` |
| 4 | Editor | User clicks "Save ATC" | `handleSave()` called | `components/atcs/AtcEditor.tsx` line 95 |
| 5 | Server Action | `parseStepsMarkdown(input.stepsMarkdown)` converts Markdown to `AtcStep[]` | Steps array built | `lib/atc-parse.ts` (import); `actions.ts` line 40 |
| 6 | DB | `DELETE atc_steps WHERE atc_id = ...` then `INSERT atc_steps[]` | Full replace | `supabase/migrations/0007_save_atc.sql` |
| 7 | Editor | `router.refresh()` re-fetches page | Monaco reloads with DB content | `components/atcs/AtcEditor.tsx` line 114 |

**Error Paths**

| Error | Handling | Evidence |
|---|---|---|
| Monaco editor not yet loaded (SSR boundary) | Loading placeholder shown: "Loading Monaco editor…" | `components/atcs/AtcEditor.tsx` lines 17–26 `dynamic` loading fallback |
| Steps Markdown parse failure (malformed input) | `parseStepsMarkdown` handles gracefully — returns empty array or partial | `lib/atc-parse.ts` comment: RegExp-based parser; behavior on malformed input not fully verified |

**Success Criteria**
- [ ] Monaco editor loads after initial page render (client-side only, SSR disabled)
- [ ] Edited steps persist after save and page refresh
- [ ] `atc_steps` rows match the parsed Markdown content (position order preserved)
- [ ] `updated_at` on `atcs` row reflects save timestamp

---

### J5: API consumer generates PAT → authenticates → hits REST API

**Persona**: API Consumer (machine — CI pipeline, AI agent, CLI tool)  
**Goal**: Issue a scoped PAT as a human user, then use it for machine API access  
**Discovered From**: `app/api/v1/tokens/route.ts`, `app/api/v1/tokens/[id]/route.ts`, `lib/api/middleware/bearer.ts`, `supabase/migrations/0008_access_tokens.sql`

```mermaid
flowchart LR
    A[Human: POST /api/v1/tokens with cookie session] --> B[Validate session - reject if no user]
    B --> C[Parse scopes array from request body]
    C --> D[Generate 32-byte random secret base64url]
    D --> E[tokenPrefix = secret first 12 chars]
    E --> F[hash = SHA-256 of secret]
    F --> G[INSERT access_tokens - token_prefix + hash + scopes]
    G --> H[Return bk_pat_prefix.secret ONCE in response body]
    H --> I[Machine stores token - cannot retrieve later]
    I --> J[Machine: GET /api/... Authorization: Bearer bk_pat_prefix.secret]
    J --> K[requireBearerToken parses header]
    K --> L[SELECT access_tokens WHERE token_prefix = prefix LIMIT 5]
    L --> M[SHA-256 candidate matches hash?]
    M -->|no match| N[Uniform 401]
    M -->|match| O[revoked_at IS NULL? expires_at > now?]
    O -->|fail| N
    O -->|pass| P[UPDATE last_used_at fire-and-forget]
    P --> Q[BearerContext: userId + workspaceId + scopes]
    Q --> R[requireScope check]
    R -->|scope missing| S[403 Forbidden]
    R -->|scope present| T[Route handler executes]
```

**Step-by-Step**

| Step | Page | Action | Next | Evidence |
|---|---|---|---|---|
| 1 | (Human browser) | POST `{ scopes: ['atc:read', 'run:execute'], name?: string, workspace_id?: uuid, expires_in_days?: number }` to `/api/v1/tokens` | Session validated | `app/api/v1/tokens/route.ts` lines 32–37 |
| 2 | `/api/v1/tokens` | `CreateBodySchema.parse(payload)` validates scopes enum | Error 400 if invalid | `app/api/v1/tokens/route.ts` lines 25–30 Zod schema |
| 3 | `/api/v1/tokens` | `generateSecret(32)` → 32 random bytes base64url | `~256 bits entropy` | `app/api/v1/tokens/route.ts` lines 113–116 |
| 4 | `/api/v1/tokens` | `tokenPrefix = secret.slice(0, 12)` | Indexed prefix for O(1) lookup | `app/api/v1/tokens/route.ts` line 47 |
| 5 | `/api/v1/tokens` | `hash = sha256Hex(secret)` | Only hash stored in DB | `app/api/v1/tokens/route.ts` line 48 |
| 6 | `/api/v1/tokens` | INSERT `access_tokens` via admin client | Row created | `app/api/v1/tokens/route.ts` lines 57–68 |
| 7 | Response | Return `{ token: 'bk_pat_<prefix>.<secret>', warning: 'Store this token now...' }` HTTP 201 | Secret returned ONCE | `app/api/v1/tokens/route.ts` lines 75–87 |
| 8 | (Machine) | API call with `Authorization: Bearer bk_pat_<prefix>.<secret>` | `requireBearerToken()` invoked | `lib/api/middleware/bearer.ts` |
| 9 | `bearer.ts` | Parse header → verify `bk_pat_` prefix → split on `.` → prefix + secret | Token family verified | `lib/api/middleware/bearer.ts` family prefix check |
| 10 | `bearer.ts` | `SELECT WHERE token_prefix = <prefix> LIMIT 5` | Up to 5 candidates | `lib/api/middleware/bearer.ts` |
| 11 | `bearer.ts` | For each candidate: `SHA-256(secret) === row.hash` + `revoked_at IS NULL` + `expires_at > now()` | First match wins | `supabase/migrations/0008_access_tokens.sql` hash + revocation design |
| 12 | `bearer.ts` | Fire-and-forget: `UPDATE SET last_used_at = now()` | Auth never blocks on write | `business-data-map.md` Flow 6 |
| 13 | Route handler | `requireScope(ctx, 'atc:read')` | 403 if scope missing | `lib/api/middleware/bearer.ts` `requireScope` |
| 14 | Soft-revoke | `DELETE /api/v1/tokens/[id]` (session-authenticated) → `UPDATE SET revoked_at = now()` | Row preserved for audit | `app/api/v1/tokens/[id]/route.ts` |

**Error Paths**

| Error | Handling | Evidence |
|---|---|---|
| No cookie session when issuing PAT | `ApiError('unauthorized', 'You must be signed in...')` → HTTP 401 | `app/api/v1/tokens/route.ts` lines 34–37 |
| Invalid scope value | Zod validation error `z.enum(ALLOWED_SCOPES)` → HTTP 400 | `app/api/v1/tokens/route.ts` `CreateBodySchema` |
| Bearer token not found / hash mismatch | Uniform HTTP 401 (no detail about which step failed) | `lib/api/middleware/bearer.ts` constant-time design |
| Token revoked (`revoked_at IS NOT NULL`) | Uniform HTTP 401 | `lib/api/middleware/bearer.ts` |
| Token expired (`expires_at < now()`) | Uniform HTTP 401 | `lib/api/middleware/bearer.ts` |
| Missing required scope on route | HTTP 403 | `lib/api/middleware/bearer.ts` `requireScope` |
| Token not found or already revoked on DELETE | HTTP 404 | `app/api/v1/tokens/[id]/route.ts` |

**Success Criteria**
- [ ] PAT POST returns HTTP 201 with `token` field in `bk_pat_<prefix>.<secret>` format
- [ ] `warning: 'Store this token now...'` present in response body
- [ ] `GET /api/v1/tokens` does NOT return the `hash` field
- [ ] Bearer auth with valid token returns 200 on permitted route
- [ ] Bearer auth with revoked token returns 401 (same response shape as never-valid token)
- [ ] Bearer auth with `atc:read`-only token on write endpoint returns 403
- [ ] DELETE `/api/v1/tokens/[id]` sets `revoked_at`, does NOT delete row

---

## 3. Navigation Structure

```mermaid
graph LR
    subgraph Public
        L["/login"]
        CB["/auth/callback"]
        MLINK["/api/v1/auth/magic-link"]
        HEALTH["/api/v1/health"]
        OA["/api/openapi"]
        DOCS["/api/docs"]
    end

    subgraph Authenticated
        OB["/onboarding"]
        PX["/projects"]
        PS["/projects/[projectSlug]"]
        ATC["/projects/[projectSlug]/atcs/[atcId]"]
    end

    subgraph API_Tokens["API (Cookie Session)"]
        TGET["GET /api/v1/tokens"]
        TPOST["POST /api/v1/tokens"]
        TDEL["DELETE /api/v1/tokens/[id]"]
    end

    ROOT["/"] --> L
    L --> CB
    CB --> PX
    CB --> OB
    PX --> PS
    PS --> ATC
    ATC --> PS
    PX --> OB
    OB --> PX
```

Source: `app/page.tsx` root redirect; `middleware.ts` route classification; all `redirect()` calls in `app/(app)/`.

---

## 4. Breadcrumb Patterns

Breadcrumb component `Breadcrumb` (`components/layout/Topbar.tsx`) renders an array of strings as `item / item / item` with the last item in bold monospace.

| Path | Breadcrumb | Evidence |
|---|---|---|
| `/projects/[projectSlug]` | `{workspace.name} / {project.name} / All ATCs` | `app/(app)/projects/[projectSlug]/page.tsx` lines 82–88 `Breadcrumb items={[workspace.name, project.name, 'All ATCs']}` |
| `/projects/[projectSlug]/atcs/[atcId]` | `{module.path segments} / {atc.id}` | `components/atcs/AtcEditor.tsx` lines 118–121 `breadcrumbItems = [...modulePath.split('/'), atc.id]` |

Source: `components/layout/Topbar.tsx` `Breadcrumb` component; `components/atcs/AtcEditor.tsx` line 119.

---

## 5. Critical Paths

### Happy Paths

| Journey | Start | End | Business Impact |
|---|---|---|---|
| J1 — First-time auth + workspace setup | `/login` | `/projects` (empty state) | User is onboarded; workspace + owner membership exist in DB |
| J2 — Returning user reaches ATC table | `/login` | `/projects/[slug]` ATC table rendered | User can review test coverage |
| J3 — ATC authored and saved | `/projects/[slug]/atcs/[id]` editor | `toast.success('ATC saved')` + version N+1 | ATC is anchored to business requirements and ready for execution |
| J5 — PAT issued and used | `POST /api/v1/tokens` | Route handler executes with BearerContext | CI pipeline / AI agent can read ATCs for automated execution |

### Unhappy Paths

| Scenario | Expected Behavior | Evidence |
|---|---|---|
| Magic link clicked twice (OTP already used) | `/login?error=otp_exchange_failed&reason=<Supabase error message>` | `app/auth/callback/route.ts` lines 26–30 |
| Unauthenticated request to `/projects` | Redirect `/login?next=/projects` | `middleware.ts` lines 42–47 |
| ATC saved without story link | `{ ok: false, error: 'Bind to a user story before saving.' }` → `toast.error` | `actions.ts` line 26 |
| ATC saved without AC selection | `{ ok: false, error: 'Bind at least one acceptance criterion.' }` → `toast.error` | `actions.ts` line 29 |
| Project slug not in user's workspace | `notFound()` → 404 | `app/(app)/projects/[projectSlug]/page.tsx` line 33 |
| PAT used after revocation | HTTP 401 — no leak of which check failed | `lib/api/middleware/bearer.ts` uniform failure path |
| Module creation at depth 7 | PostgreSQL CHECK constraint failure | `supabase/migrations/0002_projects_modules.sql` CHECK |
| Workspace slug collision at onboarding | `toast.error('Slug "..." is taken — try another.')` | `app/(app)/onboarding/onboarding-form.tsx` line 45 |
| Open-redirect attempt via `next` param | `safeNext` sanitized to `/projects` | `app/auth/callback/route.ts` lines 14–15 |

---

## 6. Discovery Gaps

| Flow | Unknown | Question |
|---|---|---|
| J1 — "New ATC" button action | Button renders in `app/(app)/projects/[projectSlug]/page.tsx` line 95 but creates ATC shell via a mechanism not found in current code (no `onClick` handler found) | What action creates the `atcs` DB row? Is it a Server Action, a Supabase `insert`, or a future Phase E route? |
| J3 — Story + AC creation UI | `user_stories` and `acceptance_criteria` are read in editor but no CREATE form exists in any `app/` route found | How does a user create a new user story and acceptance criteria today? Is it DB-direct or a planned UI? |
| J5 — Data endpoints using PAT auth | `requireBearerToken` exists in `lib/api/middleware/bearer.ts` but no route handler imports or calls it | When will `GET /api/v1/atcs` and `PATCH /api/v1/atcs/*/status` be available? This blocks PAT consumer testing. |
| J5 — `run:execute` endpoint | Scope defined but no endpoint; `atcs.status` is only execution record | Is the plan to add `PATCH /api/v1/atcs/[id]/status` directly, or to introduce a `runs` table first? |
| Multi-workspace navigation | `WorkspaceSwitcher` renders a button with workspace/project name and `ChevronDown` but click handler is absent — no dropdown or modal attached | When will the workspace switcher dropdown be implemented? |
| Team invitation flow | `MemberStatus = 'invited'` in schema/types; no invite send/accept route found | Is member invitation via DB admin tool only, or is an invite UI planned? |

---

## 7. QA Relevance

### Critical E2E Test Scenarios

| Priority | Scenario | Journey Reference |
|---|---|---|
| P0 | Happy path: magic link email → callback → workspace creation | J1 |
| P0 | ATC anchoring enforcement — save blocked without story+AC | J3 |
| P0 | Revoked PAT returns HTTP 401 uniformly | J5 |
| P0 | RLS cross-workspace isolation — user A cannot see user B's ATCs | All journeys |
| P1 | Returning user reaches ATC table after login | J2 |
| P1 | ATC version increments on every save | J3 |
| P1 | Monaco editor loads after page render (SSR disabled) | J4 |
| P1 | `atc_steps` fully replaced on save (no stale rows) | J3, J4 |
| P1 | PAT with `atc:read` only → write attempt returns 403 | J5 |
| P2 | Error messages surface correctly: missing code, OTP expired, slug collision | J1 |
| P2 | Module depth 7 creation rejected by DB CHECK constraint | J3 (module setup) |
| P2 | `WorkspaceSwitcher` renders workspace name and project name correctly | J2 |

### Suggested Test Data

| Journey | Test User | Prerequisites |
|---|---|---|
| J1 — Onboarding | `owner_test@example.com` (no prior workspace) | Fresh Supabase Auth user; no `workspace_members` row |
| J2 — Login to ATC table | `member_test@example.com` | Active workspace membership; ≥1 project with ≥1 ATC |
| J3 — ATC authoring | `member_test@example.com` | Active workspace membership; ≥1 module; ≥1 user story with ≥1 AC |
| J4 — ATC step edit | `member_test@example.com` | Same as J3 + ATC with ≥1 existing step |
| J5 — PAT issuance | `owner_test@example.com` (browser session) + machine script | Cookie session active; `atc:read` + `run:execute` scopes requested |

Note: Magic-link auth in E2E tests requires a test strategy — either intercept Supabase `signInWithOtp` response and directly call `supabase.auth.admin.generateLink()` or inject a pre-issued session cookie using `SUPABASE_SERVICE_ROLE_KEY`. No `data-testid` attributes exist on any UI component as of discovery — Playwright selectors must use role/label/text or be established during `/adapt-framework`.

Source: `.context/infrastructure/frontend.md` "Test Integration Points" section.
