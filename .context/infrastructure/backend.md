# Backend Infrastructure

> Project: Bunkai TMS
> Generated: 2026-05-25
> Source: /project-discovery Phase 3 - Infrastructure

---

## Runtime

| Runtime | Version | Language | Package Manager |
|---|---|---|---|
| Node.js (Bun-compatible) | >=18 (Next.js 15 requirement) | TypeScript 5.9.3 | Bun (bun.lock present) |
| Bun | >=1.0.0 | TypeScript / JS | - |

> No `.nvmrc` or `engines` field in `package.json`. Version inferred from Next.js 15 (requires Node 18+) and `bun-types` devDependency.

---

## Package Scripts

The TMS repo uses the agentic-dev-boilerplate template scripts. Next.js lifecycle commands run via the `next` binary (`node_modules/.bin/next`).

| Name | Command | Purpose |
|---|---|---|
| `dev` | `bunx next dev` | Start Next.js dev server on port 3000 |
| `build` | `bunx next build` | Production build |
| `start` | `bunx next start` | Start production server |
| `agents:setup` | `bun scripts/agents-setup.ts` | Configure `.agents/` project variables |
| `api:sync` | `bun scripts/sync-openapi.ts` | Sync OpenAPI types from live spec |
| `claude` | `dotenv -e .env -- claude` | Launch Claude Code with `.env` loaded |
| `format:check` | `prettier --check ...` | Check formatting |
| `format:fix` | `prettier --write ...` | Fix formatting |
| `jira:check` | `bun scripts/check-jira-setup.ts` | Verify Jira configuration |
| `jira:sync-fields` | `bun scripts/sync-jira-fields.ts` | Sync Jira custom field IDs |
| `jira:sync-issues` | `bun scripts/sync-jira-issues.ts` | Sync Jira issues to `.context/PBI/` |
| `jira:sync-link-types` | `bun scripts/sync-jira-link-types.ts` | Sync Jira link type IDs |
| `jira:sync-workflows` | `bun scripts/sync-jira-workflows.ts` | Sync Jira workflow statuses + transitions |
| `lint:check` | `eslint .` | Run ESLint |
| `lint:fix` | `eslint --fix .` | Fix ESLint errors |
| `onboarding` | `bun scripts/onboarding.ts` | Run interactive onboarding |
| `opencode` | `dotenv -e .env -- opencode` | Launch OpenCode with `.env` loaded |
| `prepare` | `husky` | Install Husky git hooks |
| `repo:check` | chain: format + lint + types + vars + skills | Full repo health check |
| `repo:fix` | chain: format:fix + lint:fix + ... | Fix all linting/formatting issues |
| `setup:doctor` | `bun cli/doctor.ts` | Check prerequisites only |
| `setup` | `bun cli/doctor.ts --preflight && bun cli/install.ts` | Full project setup |
| `skills:check` | `bun scripts/lint-skills.ts` | Lint skill files |
| `skills:registry:check` | `bun scripts/build-skill-registry.ts --check` | Check skill registry freshness |
| `skills:registry` | `bun scripts/build-skill-registry.ts` | Regenerate skill registry |
| `types:check` | `tsc --noEmit` | TypeScript type check |
| `up` | `bun cli/update-boilerplate.ts` | Update boilerplate to latest version |
| `vars:check` | `bun scripts/lint-vars.ts` | Validate `.agents/project.yaml` variables |
| `openapi:gen` | `bun scripts/openapi-gen.ts` (TMS-specific) | Regenerate `public/openapi.json` |
| `supabase:types` | `bun scripts/gen-supabase-types.ts` (TMS-specific) | Regenerate `lib/types/supabase.ts` |

---

## Core Dependencies

| Category | Package | Version | Purpose |
|---|---|---|---|
| Framework | `next` | `^15` (15.5.18 installed) | Full-stack React framework |
| Framework | `react` | `^19` | UI library |
| Framework | `react-dom` | `^19` | DOM renderer |
| Database Client | `@supabase/supabase-js` | `2.106` | Supabase JS client (PostgREST + Auth + Realtime) |
| Auth / SSR | `@supabase/ssr` | `0.10.3` | Server-side Supabase client + cookie session |
| Validation | `zod` | `4.4.3` | Runtime schema validation + type inference |
| API Docs | `@asteasolutions/zod-to-openapi` | `8.5` | OpenAPI spec generation from Zod schemas |
| API Docs | `@scalar/api-reference-react` | latest | Interactive API docs UI (`/api/docs`) |
| UI State | `@tanstack/react-table` | `8.21` | Data grid (headless table) |
| Editor | `@monaco-editor/react` | `4.7` | Monaco code editor for ATC step authoring |
| UI Primitives | `@radix-ui/*` | latest | Dialog, DropdownMenu, Tabs, Tooltip (via shadcn/ui) |
| UI Commands | `cmdk` | `1.1` | Command palette |
| Notifications | `sonner` | `2.0` | Toast notifications |
| Icons | `lucide-react` | `1.16` | Icon library |
| Styling | `tailwindcss` | `3.4` | Utility-first CSS |
| Dev Tools | `typescript` | `5.9.3` | TypeScript compiler |
| Dev Tools | `eslint` | `^9.28.0` | Linting (antfu config) |
| Dev Tools | `prettier` | `^3.7.4` | Code formatting |
| Dev Tools | `husky` | `^9.1.7` | Git hooks |
| Dev Tools | `dotenv-cli` | `^8.0.0` | Env loading for agent CLIs |

---

## Environment Variables - Backend

### Required (server startup fails if missing)

Source: `lib/env.ts` — Zod validates these three at startup. Missing = `Error: [bunkai/env] Invalid environment variables`.

| Name | Example Format | Purpose | Required? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase project URL (client + server) | YES |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (JWT) | Supabase publishable key (browser-safe) | YES |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (JWT) | Service role key — bypasses RLS, server-only | YES |

### Optional

| Name | Example Format | Purpose | Required? |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Auth redirect base URL | Optional |
| `SUPABASE_JWT_SECRET` | alphanumeric string | Sign/verify custom JWTs | Optional |
| `SUPABASE_PROJECT_REF` | `abcdefghijklmno` | Override for `gen-supabase-types.ts` | Optional (derived from URL if absent) |

### External Services / Tooling

| Name | Example Format | Purpose | Required? |
|---|---|---|---|
| `RESEND_API_KEY` | `re_...` | Transactional email (magic link delivery) | YES for auth |
| `SUPABASE_ACCESS_TOKEN` | `sbp_...` | Supabase MCP control-plane admin token | MCP only |
| `POSTGRES_HOST` | `db.<ref>.supabase.co` | Direct Postgres host | Optional |
| `POSTGRES_USER` | `postgres` | Postgres user | Optional |
| `POSTGRES_PASSWORD` | — | Postgres password | Optional |
| `POSTGRES_DATABASE` | `postgres` | Postgres database name | Optional |
| `POSTGRES_URL` | `postgres://...` | Pooled connection (port 6543) | Optional |
| `POSTGRES_URL_NON_POOLING` | `postgres://...` | Direct connection (port 5432) | Optional |
| `ATLASSIAN_URL` | `https://<org>.atlassian.net/` | Atlassian site (CLI/MCP) | CLI only |
| `ATLASSIAN_EMAIL` | `user@domain.com` | Atlassian account email | CLI only |
| `ATLASSIAN_API_TOKEN` | alphanumeric | Atlassian API token | CLI only |
| `TAVILY_API_KEY` | `tvly-...` | Tavily web search MCP | MCP only |
| `N8N_API_URL` | `https://n8n.example.com/api/v1` | n8n workflow automation URL | Optional |
| `N8N_API_KEY` | alphanumeric | n8n API key | Optional |

> **KEY NAME DISCREPANCY (Discovery Gap):** `.env.example` uses `SUPABASE_PUBLISHABLE_KEY` (new-style Supabase naming). `lib/env.ts` and `middleware.ts` both use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Authoritative key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Database Configuration

| Setting | Value |
|---|---|
| Type | PostgreSQL |
| Provider | Supabase (managed cloud) |
| ORM | None — Supabase JS client + raw RPC calls |
| Migration tool | Supabase CLI (`supabase db push`) |
| RLS | Enabled on all tables |
| RLS helper functions | `bunkai_is_workspace_member`, `bunkai_can_write_workspace`, `bunkai_is_workspace_admin`, `bunkai_is_workspace_owner` |
| Migrations directory | `supabase/migrations/` (8 files) |
| Type generation | `lib/types/supabase.ts` (via `bun scripts/gen-supabase-types.ts`) |

### Migration Files

| File | Purpose |
|---|---|
| `0001_tenancy.sql` | Workspace + membership tables |
| `0002_projects_modules.sql` | Projects + modules tables |
| `0003_authoring.sql` | User stories + acceptance criteria |
| `0004_atcs.sql` | ATC + steps + assertions tables |
| `0005_rls_helpers.sql` | RLS helper functions (4 `bunkai_*` helpers) |
| `0006_bootstrap_workspace.sql` | RPC `bunkai_bootstrap_workspace` |
| `0007_save_atc.sql` | RPC `bunkai_save_atc` (transactional ATC save) |
| `0008_access_tokens.sql` | Personal access tokens table + PAT auth |

### Key RPCs

| RPC | Parameters | Purpose |
|---|---|---|
| `bunkai_bootstrap_workspace` | `p_slug`, `p_name` | Create workspace + assign caller as owner |
| `bunkai_save_atc` | `p_atc_id, p_title, p_layer, p_tags, p_user_story_id, p_steps, p_assertions, p_ac_ids` | Transactional ATC upsert — links steps, assertions, ACs atomically |

---

## Migration Commands

```bash
# Apply migrations to connected Supabase project
supabase db push

# Reset database (destructive — local only)
supabase db reset

# Start local Supabase stack (requires Docker)
supabase start

# Stop local Supabase stack
supabase stop

# Regenerate TypeScript types from live schema
bun scripts/gen-supabase-types.ts

# Regenerate OpenAPI JSON from route openapi files
bun scripts/openapi-gen.ts
```

---

## Auth Flow

**Web browser (magic link):**

```
User submits email on /login
  -> POST /api/v1/auth/magic-link { email, next? }
  -> Supabase Auth sends OTP email via Resend
  -> User clicks email link
  -> GET /auth/callback?code=<otp>&next=<path>
  -> supabase.auth.exchangeCodeForSession(code)
  -> Session stored as HttpOnly SSR cookie (@supabase/ssr)
  -> User redirected to safeNext (/projects or custom path)
```

**CLI / AI-agent (bearer token):**

```
POST /api/v1/tokens { scopes, name?, workspace_id?, expires_in_days? }
  -> Returns bk_pat_<prefix>.<secret> once (never retrievable again)
  -> API calls: Authorization: Bearer bk_pat_<prefix>.<secret>
  -> lib/api/middleware/bearer.ts: SHA-256(secret) match + not revoked + not expired
  -> DELETE /api/v1/tokens/[id] soft-revokes (revoked_at set, row kept for audit)
```

**`middleware.ts` route classification:**

- Protected prefixes: `/projects`, `/onboarding` — require cookie session
- Public prefixes: `/login`, `/auth`, `/api/auth` — pass through
- Unauthenticated on protected route — redirect to `/login?next=<pathname>`
- Session refresh: `supabase.auth.getUser()` called on every request

---

## API Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/health` | None | Liveness probe — service identity + env + timestamp |
| `POST` | `/api/v1/auth/magic-link` | None | Initiate magic link OTP email |
| `GET` | `/auth/callback` | None | Exchange OTP code for session cookie |
| `POST` | `/api/v1/tokens` | Cookie session | Issue new personal access token (PAT) |
| `GET` | `/api/v1/tokens` | Cookie session | List caller tokens (no secret returned) |
| `DELETE` | `/api/v1/tokens/[id]` | Cookie session | Soft-revoke token by UUID |
| `GET` | `/api/openapi` | None | OpenAPI JSON spec (runtime-generated) |
| `GET` | `/api/docs` | None | Interactive Scalar API reference UI |

PAT scopes available: `atc:read`, `atc:write`, `run:execute`, `workspace:admin`

---

## Local Development Setup

```bash
# Prerequisites: Bun >= 1.0.0, Docker, Supabase CLI

# 1. Clone and install
git clone <repo-url>
cd upex-bunkai-tms
bun install

# 2. Environment setup
cp .env.example .env
# Fill in .env - minimum required:
# NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# RESEND_API_KEY=re_<key>
# NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Start local Supabase (Docker must be running)
supabase start
supabase db push

# 4. Start Next.js dev server
bunx next dev

# 5. Verify
curl http://localhost:3000/api/v1/health
# Expected: {"ok":true,"service":"bunkai-tms","env":"local","ts":"..."}
```

---

## Health Check Endpoints

| Endpoint | Method | Auth | Response Shape |
|---|---|---|---|
| `/api/v1/health` | `GET` | None | `{ ok: true, service: "bunkai-tms", env: "local/staging/production", ts: "<ISO8601>" }` |

---

## Discovery Gaps

| Gap | Severity | Notes |
|---|---|---|
| No `supabase/config.toml` committed | LOW | Local Supabase config absent; relies on CLI defaults or manual `supabase init` |
| `SUPABASE_PUBLISHABLE_KEY` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY` naming inconsistency | MEDIUM | `.env.example` uses former; `lib/env.ts` validates latter. Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| No `dev`/`build`/`start` in `package.json` scripts | LOW | Next.js lifecycle: `bunx next dev` / `bunx next build` / `bunx next start` |
| N8N integration purpose unknown | LOW | `N8N_API_URL` + `N8N_API_KEY` in `.env.example`; zero usage in app code |
| Magic-link rate limiting not implemented | MEDIUM | `route.ts` comment: "Phase F adds real rate-limit middleware"; current = forward Supabase 429 verbatim |
| Resend sender address not configurable via env | LOW | Sending domain/from-address lives in Supabase email templates or Resend dashboard |
