# Business Model — Bunkai TMS

> Confidence: **Medium** — business intent reconstructed from design docs, product copy, and database schema. No external market research performed. Revenue model and pricing are partially inferred.  
> Generated: 2026-05-25  
> Source: /project-discovery Phase 1

---

## Problem Statement

QA teams working on software products today lack a lightweight, developer-first tool for managing Acceptance Test Cases (ATCs) that links seamlessly from business stories through to automated execution. Existing TMS tools are either enterprise-heavy (Zephyr, TestRail), disconnected from code, or require manual bridging between Jira stories and actual test definitions. The result is test documentation that drifts from the living codebase and cannot be executed by AI agents or CI pipelines without custom glue code.

Source: `upex-bunkai-tms/DESIGN.md` §2 ("Information density first. QAs manage hundreds of ATCs daily"), §1 ("precise, dense, developer-first, opinionated about quality"); `app/(auth)/login/page.tsx` FEATURE_TICKS array ("IQL — Integrated Quality Lifecycle", "ATC — Acceptance Test Case — one observable behaviour, executable by humans or agents")

Bunkai addresses this by implementing the **IQL (Integrated Quality Lifecycle)** methodology: a structured pipeline from story definition → acceptance criteria → ATC authoring → test execution → defect linkage. ATCs are first-class citizens with their own schema, versioning, and status lifecycle (pass/fail/blocked/skipped/running/unrun), stored in a Supabase Postgres database with full Row-Level Security and queryable by humans, AI agents, and CI pipelines via a REST API.

Source: `supabase/migrations/0004_atcs.sql` (ATC schema + status enum); `app/(auth)/login/page.tsx` FEATURE_TICKS ("IQL", "ATC", "KATA", "×3"); `lib/types.ts` (AtcStatus type)

The system is multi-tenant (workspace-scoped), open-source (Apache-2.0), and designed for both self-hosted teams and a cloud offering. Personal Access Tokens (PATs) with scoped permissions (`atc:read`, `atc:write`, `run:execute`, `workspace:admin`) enable CLI tooling, AI agents, and CI integrations to authenticate without user sessions.

Source: `supabase/migrations/0008_access_tokens.sql` (PAT schema + scopes); `app/(auth)/login/page.tsx` FEATURE_TICKS ("OSS — Apache-2.0. Self-host with one docker compose, or use Cloud")

---

## Business Model Canvas

### 1. Customer Segments

| Segment | Description | Evidence |
|---|---|---|
| QA engineers / testers | Primary users; create and manage ATCs daily | DESIGN.md §2 "QAs manage hundreds of ATCs daily" |
| Development teams | Write stories and ACs that ATCs trace back to | migrations/0003 `user_stories` + `acceptance_criteria` tables |
| Engineering managers / QA leads | Review test coverage, pass/fail metrics | DESIGN.md §1 (VS Code/GitHub-inspired density for professionals) |
| AI agents / CLI tooling | Machine consumers of the PAT API | migrations/0008 PAT scopes; "×3 Manual · Agentic · CI execution" |

Source: `upex-bunkai-tms/DESIGN.md` §1–2; `app/(auth)/login/page.tsx` FEATURE_TICKS; `supabase/migrations/0008_access_tokens.sql`

### 2. Value Propositions

| Proposition | Description | Evidence |
|---|---|---|
| ATC anchoring moat | Every ATC must reference ≥1 acceptance criterion — traceability enforced at DB layer | migrations/0004 `atc_acceptance_criteria` M:N table + comment "anchoring moat" |
| IQL methodology | Story → AC → ATC → Run → Defect pipeline in a single tool | FEATURE_TICKS "IQL — Integrated Quality Lifecycle" |
| Three execution modes | Same ATC schema drives manual, agentic (AI), and CI test runs | FEATURE_TICKS "×3 Manual · Agentic · CI execution. Same schema, same reports." |
| Developer-first density | VS Code-inspired layout; monospace IDs; dark-first design | DESIGN.md §1–5 |
| Open source + self-host | Apache-2.0; one docker compose for self-hosted | FEATURE_TICKS "OSS — Apache-2.0. Self-host with one docker compose" |
| KATA compatibility | ATCs map to KATA (Komponent Action Test Architecture) test automation | FEATURE_TICKS "KATA — Komponent Action Test Architecture" |

Source: `upex-bunkai-tms/DESIGN.md` §1–2; `app/(auth)/login/page.tsx` FEATURE_TICKS; `supabase/migrations/0004_atcs.sql`

### 3. Channels

| Channel | Status | Evidence |
|---|---|---|
| Web application (`https://upexbunkai.vercel.app`) | Active (Vercel deployment) | `.agents/project.yaml` `webapp_domain` |
| Staging environment (`https://staging-upexbunkai.vercel.app`) | Active | `.agents/project.yaml` environments |
| REST API (`/api/v1/`) | Active (OpenAPI documented) | `app/api/v1/` route handlers; `app/api/openapi/` |
| CLI via PAT bearer auth | Designed (PAT schema exists) | `supabase/migrations/0008_access_tokens.sql` |
| Self-hosted (docker compose) | Planned (per FEATURE_TICKS) | FEATURE_TICKS "Self-host with one docker compose" |
| Magic-link email onboarding | Active | `app/api/v1/auth/magic-link/`; `RESEND_API_KEY` in `.env.example` |

Source: `.agents/project.yaml`; `app/api/v1/`; `.env.example`; `app/(auth)/login/page.tsx`

### 4. Customer Relationships

| Type | Description | Evidence |
|---|---|---|
| Self-service onboarding | Magic-link auth → workspace creation → project setup | `app/(app)/onboarding/page.tsx`; migrations/0001 workspaces |
| Workspace-based collaboration | Multi-member workspaces with role-based access | migrations/0001 `workspace_members` (viewer/member/admin/owner) |
| API-first integration | PATs allow external tools and AI agents to integrate | migrations/0008 PAT schema |

Source: `supabase/migrations/0001_tenancy.sql`; `supabase/migrations/0008_access_tokens.sql`; `app/(app)/onboarding/page.tsx`

### 5. Revenue Streams

| Stream | Description | Confidence |
|---|---|---|
| Cloud SaaS (subscription) | `plan` field has `community`, `cloud`, `enterprise` tiers | Medium — inferred from `workspaces.plan` enum |
| Self-hosted (free/open-source) | Community tier, no revenue | High — Apache-2.0 license |
| Enterprise licensing | `enterprise` plan tier present in schema | Low — no pricing logic found in code |

Source: `supabase/migrations/0001_tenancy.sql` `workspaces.plan check ('community','cloud','enterprise')`. Note: no payment processor or billing code found in codebase during discovery.

### 6. Key Resources

| Resource | Description | Evidence |
|---|---|---|
| Supabase Postgres database | Core data store — all entities, RLS, migrations | `supabase/migrations/` (8 files) |
| Next.js App Router (FE+BE) | Unified deployment on Vercel | `next.config.ts`; `bun.lock` `next: ^15` |
| Supabase Auth (magic link) | Passwordless authentication | `middleware.ts`; `lib/supabase/client.ts` |
| OpenAPI contract | Machine-readable API surface | `app/api/openapi/`; `lib/openapi/registry.ts` |
| DESIGN.md + design system | Visual identity + component vocabulary | `DESIGN.md` §3–6 |

Source: `next.config.ts`; `supabase/migrations/`; `middleware.ts`; `DESIGN.md`

### 7. Key Activities

| Activity | Description | Evidence |
|---|---|---|
| ATC authoring + versioning | Create/edit ATCs with steps, assertions, AC links | `app/(app)/projects/[projectSlug]/atcs/[atcId]/`; `supabase/migrations/0007_save_atc.sql` |
| Project + module management | Hierarchical test structure (workspace → project → module tree) | `supabase/migrations/0002_projects_modules.sql` |
| Story + AC management | Authoring user stories with sortable acceptance criteria | `supabase/migrations/0003_authoring.sql` |
| PAT issuance + management | Issue and revoke personal access tokens for CLI/AI access | `app/api/v1/tokens/route.ts` |
| Workspace onboarding | New user → workspace creation → team invites | `app/(app)/onboarding/`; migrations/0001 |
| API-driven test execution | External tools query and update ATC status via REST | `app/api/v1/`; PAT scopes `atc:read`, `run:execute` |

Source: `app/(app)/` route structure; `supabase/migrations/0003_authoring.sql`; `supabase/migrations/0007_save_atc.sql`; `app/api/v1/tokens/route.ts`

### 8. Key Partners

| Partner | Role | Evidence |
|---|---|---|
| Supabase | Database, auth, RLS infrastructure | `bun.lock` `@supabase/supabase-js`, `@supabase/ssr`; `SUPABASE_ACCESS_TOKEN` in `.env.example` |
| Vercel | Hosting, serverless deployment, env management | `.agents/project.yaml` `webapp_domain: upexbunkai.vercel.app` |
| Resend | Transactional email (magic link delivery) | `RESEND_API_KEY` in `.env.example` |
| Atlassian (Jira) | External issue tracker integration (`external_id` + `external_url` on user_stories) | `supabase/migrations/0003_authoring.sql` `external_id`/`external_url` columns; `.env.example` `ATLASSIAN_*` |
| n8n | Workflow automation (env vars present, usage TBD) | `N8N_API_URL`, `N8N_API_KEY` in `.env.example` |
| Radix UI / shadcn | Component library | `bun.lock` `@radix-ui/*` packages; `components.json` |

Source: `bun.lock`; `.env.example`; `.agents/project.yaml`

### 9. Cost Structure

| Cost | Type | Evidence |
|---|---|---|
| Vercel hosting | Variable (serverless compute + bandwidth) | Vercel deployment inferred from `webapp_domain` |
| Supabase | Variable (database + auth + storage) | `SUPABASE_ACCESS_TOKEN` + managed Postgres |
| Resend email | Variable (transactional email volume) | `RESEND_API_KEY` |
| Development labor | Fixed | codebase size + active development inferred from migration history |

Source: `.env.example`; `.agents/project.yaml`. Note: actual cost figures not available from code.

---

## Discovery Gaps

| Gap | Impact |
|---|---|
| No pricing or billing code found in repo | Cannot confirm revenue model or tier gating logic |
| `workspaces.plan` enum exists but no enforcement logic found | Unclear whether `cloud`/`enterprise` plans are gated in app logic |
| n8n integration purpose unknown | `N8N_API_URL`/`N8N_API_KEY` present in `.env.example`; no n8n calls found in app code during discovery |
| No `run` / `test execution` table in migrations | PAT has `run:execute` scope but no `runs` table found — execution tracking may be a planned feature |
| Docker compose self-host instructions not found in repo | FEATURE_TICKS references it; no `docker-compose.yml` in root |
| Market context and competitor analysis | Not available from code reverse-engineering; requires external research |

---

## QA Relevance

| Business Aspect | Testing Implication |
|---|---|
| Multi-tenant RLS | Every test must be workspace-scoped; cross-workspace data leakage is a critical security test |
| ATC anchoring moat (≥1 AC required) | Test that ATCs cannot be saved without at least one linked AC |
| Three-tier role system (viewer/member/admin/owner) | Role-based access tests for every mutation endpoint |
| Magic-link auth (no password) | Test auth flow for valid email, invalid email, expired link, already-used link |
| PAT scopes | Test that `atc:read` token cannot write; `atc:write` cannot execute runs; etc. |
| ATC status lifecycle (6 states) | Test all valid/invalid state transitions |
| Module tree depth limit (max 6) | Test that depth-7 module creation is rejected |
| Workspace plan tiers | When plan gating is implemented, test community/cloud/enterprise boundaries |
| `version` bump on every ATC save | Test optimistic locking via `bunkai_save_atc` RPC |
| Soft-delete on PATs (revoked_at, no DELETE) | Test that revoked tokens are rejected; no token can be hard-deleted |

---

## Sources Used

| Source | Used for |
|---|---|
| `upex-bunkai-tms/DESIGN.md` | Brand identity, product philosophy, design principles, component vocabulary |
| `upex-bunkai-tms/app/(auth)/login/page.tsx` | FEATURE_TICKS product copy (IQL, ATC, KATA, ×3, OSS) |
| `upex-bunkai-tms/supabase/migrations/0001_tenancy.sql` | Workspace + workspace_members schema, plan tiers, RBAC roles |
| `upex-bunkai-tms/supabase/migrations/0002_projects_modules.sql` | Project + module hierarchy |
| `upex-bunkai-tms/supabase/migrations/0003_authoring.sql` | User stories + acceptance criteria; Jira external_id link |
| `upex-bunkai-tms/supabase/migrations/0004_atcs.sql` | ATC schema, status enum, layer enum, anchoring moat M:N table |
| `upex-bunkai-tms/supabase/migrations/0008_access_tokens.sql` | PAT schema, scopes, soft-delete model |
| `upex-bunkai-tms/bun.lock` | Actual dependency versions (Next.js 15, React 19, Supabase 2.106, etc.) |
| `upex-bunkai-tms/.env.example` | External integration key names (Supabase, Vercel, Resend, Atlassian, n8n) |
| `bunkai-qa-engineering/.agents/project.yaml` | Environment URLs, project key BK, Jira/testing config |
