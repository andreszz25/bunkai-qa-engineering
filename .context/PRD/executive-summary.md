# PRD — Executive Summary: Bunkai TMS

> Discovery type: Reverse-engineering from source code (read-only).
> Generated: 2026-05-28
> Source repos: `/home/andreszz25/upex/upex-bunkai-tms/`
> Every claim cites the source file. Do NOT add business logic not confirmed in code.

---

## 1. Problem Statement

### The Challenge

QA engineers working on modern software products lack a lightweight, developer-first tool that links backlog stories and acceptance criteria to executable test cases in a single, auditable system. Existing test management tools are either enterprise-heavy (Zephyr, TestRail) or disconnected from code, requiring manual bridging between Jira issues and actual test definitions. The result is test documentation that drifts from the living codebase and cannot be executed by AI agents or CI pipelines without custom glue code.

Source: `app/(auth)/login/page.tsx` line 85: "for QA engineers who think in reusable test cases, not freeform steps. Manual, agentic, and CI execution converge on the same source of truth."

The current alternative — managing ATCs as spreadsheets, Jira subtasks, or prose in Confluence — breaks the traceability chain from business requirement to verified test outcome. There is no enforced link between a Jira story, its acceptance criteria, and the test cases that prove them; any connection is convention, not constraint.

Source: `supabase/migrations/0004_atcs.sql` comment: "anchoring moat — ATC cannot be saved without at least one AC link"; `supabase/migrations/0003_authoring.sql` `external_id`/`external_url` columns on `user_stories`.

A third gap is execution diversity: the same test specification must drive manual QA sessions, AI-agent runs, and CI pipeline executions. No existing tool treats all three modes as first-class consumers of the same schema.

Source: `app/(auth)/login/page.tsx` FEATURE_TICKS: `['×3', 'Manual · Agentic · CI execution. Same schema, same reports.']`

### Current Alternatives

| Alternative | Weakness | Evidence |
|---|---|---|
| Zephyr / TestRail | Enterprise-heavy; disconnected from code; high setup cost | `DESIGN.md` §1 "precise, dense, developer-first" (implicit contrast) |
| Jira subtasks for test cases | No ATC schema, no status lifecycle, no step/assertion structure | `supabase/migrations/0004_atcs.sql` — custom schema not available in Jira |
| Freeform Confluence / Notion | No enforced traceability; cannot be queried by CLI or AI agent | PAT API design implies machine-readable need not met by prose tools |

---

## 2. Solution Overview

### Product Vision

Bunkai is a test management system that decomposes user stories into executable Acceptance Test Cases, enforcing traceability from business requirement to test proof through the IQL (Integrated Quality Lifecycle) methodology.

Source: `app/(auth)/login/page.tsx` h1: "A test management system that decomposes user stories into executable Acceptance Test Cases."

### Core Capabilities

| # | Feature | Problem Addressed | Evidence |
|---|---|---|---|
| 1 | **IQL-structured authoring** — Story → AC → ATC pipeline enforced at DB layer | Test drift from requirements | `app/(auth)/login/page.tsx` FEATURE_TICKS `['IQL', ...]`; `supabase/migrations/0004_atcs.sql` `atc_acceptance_criteria` M:N table |
| 2 | **ATC editor** — Monaco-powered editor for steps (Markdown) and assertions (YAML) with real-time anchoring validation | Manual test authoring UX gap | `components/atcs/AtcEditor.tsx`; `components/atcs/StepEditor.tsx` (`@monaco-editor/react` loaded via `dynamic`) |
| 3 | **Module tree** — Hierarchical (up to depth 6) project/module/story organization with sidebar explorer | Flat test list management failure | `components/layout/Sidebar.tsx`; `supabase/migrations/0002_projects_modules.sql` CHECK constraint |
| 4 | **Personal Access Tokens (PAT)** — Scoped bearer tokens for CLI, AI agents, and CI pipelines | No machine-readable API for non-browser consumers | `app/api/v1/tokens/route.ts` ALLOWED_SCOPES; `supabase/migrations/0008_access_tokens.sql` |
| 5 | **Multi-tenant workspace + RBAC** — Workspace isolation under Supabase RLS with viewer/member/admin/owner roles | Team isolation and access control | `supabase/migrations/0001_tenancy.sql`; `supabase/migrations/0005_rls_helpers.sql` |

### Key Differentiators

| Differentiator | Mechanism | Evidence |
|---|---|---|
| Anchoring moat | ATC cannot be saved without ≥1 linked AC — enforced at app layer, structural at DB | `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts` line 27-29; `components/atcs/AtcEditor.tsx` `isAnchored` guard |
| KATA compatibility | ATCs carry layer classification (UI/API/Unit) matching KATA test architecture | `app/(auth)/login/page.tsx` FEATURE_TICKS `['KATA', 'Komponent Action Test Architecture...']`; `lib/types.ts` AtcLayer type |
| Open-source + self-hostable | Apache-2.0; footer shows `$ docker compose up` hint | `app/(auth)/login/page.tsx` footer; `DESIGN.md` §1 Apache-2.0 |
| Developer-first density | VS Code-inspired layout; monospace IDs; dark-first; 13px base font; 4-px grid | `DESIGN.md` §1–5 |
| Version-tracked test cases | Every ATC save increments `version` — optimistic locking for future concurrency | `supabase/migrations/0007_save_atc.sql` `version = version + 1`; `lib/types.ts` Atc.version |

---

## 3. Success Metrics

### Tracked Metrics

No analytics event tracking (`posthog`, `amplitude`, `mixpanel`, `sentry`, `datadog`) was found in any `.ts`/`.tsx` file.

Source: `grep -rn "analytics\|posthog\|amplitude\|mixpanel\|sentry\|datadog" /upex-bunkai-tms/**` returned zero application-code hits.

### Inferred KPIs (from features — not real tracking)

> All items below are INFERRED — no `track()` call-site exists in codebase.

| KPI | Inferred From |
|---|---|
| ATCs created per workspace per week | `supabase/migrations/0004_atcs.sql` `created_at` column |
| ATC anchoring rate (% with ≥1 AC) | `atc_acceptance_criteria` table — rows vs. ATC count |
| ATC version depth (mean saves per ATC) | `atcs.version` column incremented on every save |
| PAT issuance rate | `access_tokens` `created_at` |
| Workspace activation rate (onboarding completion) | `workspace_members` `status = 'active'` + `joined_at` |
| ATC status distribution (pass/fail/blocked/unrun) | `atcs.status` column |

### Unknown Metrics (gaps)

| Metric | Why Unknown |
|---|---|
| Test execution success rate over time | No `runs`/`test_executions` table exists — status is on `atcs` row directly (overwrites) |
| Magic link email delivery rate | Handled by Supabase Auth + Resend; no event surfaced to app layer |
| User retention / DAU / MAU | No analytics SDK found |
| API usage per PAT scope | `last_used_at` exists but no aggregation endpoint |

---

## 4. Target Users

### QA Engineers / Testers

System roles: `member`, `admin`, `owner`. Primary authors of ATCs; interact with the Monaco editor, module tree, and anchoring panel daily. Evidence: `DESIGN.md` §2 "QAs manage hundreds of ATCs daily"; `app/(auth)/login/page.tsx` "for QA engineers who think in reusable test cases."

### Development Team Members / PMs (Story Authors)

System role: `member`. Create user stories and acceptance criteria that ATCs trace back to. Evidence: `supabase/migrations/0003_authoring.sql` `user_stories` + `acceptance_criteria` tables; `components/atcs/AnchoringPanel.tsx` story search with Jira `external_id` support.

### Engineering Managers / QA Leads

System roles: `admin`, `owner`. Review test coverage via the ATC table; manage workspace membership and project access. Evidence: `components/atcs/AtcTable.tsx` sortable columns (layer, status, module); `supabase/migrations/0001_tenancy.sql` `admin`/`owner` roles.

### AI Agents / CLI Tools / CI Pipelines

Auth mode: PAT bearer. Machine consumers of the REST API; read ATCs with `atc:read` scope, report results with `run:execute` scope. Evidence: `app/api/v1/tokens/route.ts` ALLOWED_SCOPES; `app/(auth)/login/page.tsx` FEATURE_TICKS `['×3', '...CI execution']`.

Full persona detail: `.context/PRD/user-personas.md`

---

## 5. Product Scope

### What's Included (current capabilities — evidence-backed)

| Capability | Evidence |
|---|---|
| Magic-link authentication (passwordless) | `app/api/v1/auth/magic-link/route.ts`; `app/auth/callback/route.ts` |
| Workspace creation and onboarding wizard | `app/(app)/onboarding/page.tsx`; `app/(app)/onboarding/onboarding-form.tsx` |
| Project browsing and ATC list table | `app/(app)/projects/[projectSlug]/page.tsx`; `components/atcs/AtcTable.tsx` |
| ATC editor (Monaco, Markdown steps, YAML assertions, AC anchoring) | `components/atcs/AtcEditor.tsx`; `components/atcs/StepEditor.tsx`; `components/atcs/AnchoringPanel.tsx` |
| ATC transactional save via `bunkai_save_atc` RPC | `app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts`; `supabase/migrations/0007_save_atc.sql` |
| Module tree sidebar explorer (collapsible, depth-aware) | `components/layout/Sidebar.tsx` |
| PAT issuance, listing, and revocation via REST API | `app/api/v1/tokens/route.ts`; `app/api/v1/tokens/[id]/route.ts` |
| OpenAPI spec auto-generated at runtime | `app/api/openapi/route.ts`; `lib/openapi/registry.ts` |
| Interactive API reference (Scalar) | `app/api/docs/page.tsx` |
| Health check endpoint | `app/api/v1/health/route.ts` |
| Multi-tenant RLS (workspace isolation) | `supabase/migrations/0005_rls_helpers.sql` |
| ATC full-text search index (GIN/tsvector) | `supabase/migrations/0004_atcs.sql` `atcs_tsv_gin_idx` (index exists; search UI not found) |

### What's Not Included (known limitations)

| Limitation | Source |
|---|---|
| GitHub/Google OAuth disabled (buttons present, disabled with "soon" label) | `app/(auth)/login/page.tsx` lines 136–155 — `disabled`, `title="OAuth ships next sprint"` |
| Project creation UI — empty state placeholder only | `app/(app)/projects/page.tsx` lines 44–56 — "Project creation UI ships in Phase E" |
| Multi-workspace switcher — single workspace routed, picker deferred | `app/(app)/projects/page.tsx` line 9–10 — "Phase E will replace the empty-state placeholder + multi-workspace switcher" |
| Test execution endpoint — `run:execute` PAT scope exists but no endpoint accepts it | `business-data-map.md` Flow 7; zero `PATCH /api/v1/atcs/*/status` route found |
| Team invitation flow — `invited` status exists in schema but no invite UI route found | `lib/types.ts` MemberStatus `'invited'`; no invite route in `app/` |
| Plan tier gating — `community`/`cloud`/`enterprise` enum exists but zero enforcement logic | `supabase/migrations/0001_tenancy.sql` CHECK; no feature-flag code found |
| Self-hosted docker compose — referenced in footer copy but no `docker-compose.yml` in repo | `app/(auth)/login/page.tsx` line 101 `$ docker compose up`; no `docker-compose.yml` found |

### Future Indicators

| Indicator | Location |
|---|---|
| "OAuth ships next sprint" — GitHub + Google OAuth buttons disabled | `app/(auth)/login/page.tsx` lines 140, 150 |
| "Project creation UI ships in Phase E" | `app/(app)/projects/page.tsx` line 52 |
| "Phase F adds a real rate-limit middleware" | `app/api/v1/auth/magic-link/route.ts` line 37 |
| "Phase E will replace the empty-state placeholder + multi-workspace switcher" | `app/(app)/projects/page.tsx` line 9 |
| `run:execute` PAT scope — reserved for execution status update endpoints | `app/api/v1/tokens/route.ts` ALLOWED_SCOPES |

---

## 6. Discovery Gaps

| Gap | Impact | Suggested Source |
|---|---|---|
| No `runs`/`test_executions` DB table | Cannot verify execution history design intent; `run:execute` PAT scope has no target endpoint | Read planned migration files or product roadmap doc if available |
| No `defects`/`bugs` table despite IQL claiming defect linkage stage | IQL lifecycle incomplete — defect link from ATC is mentioned in product copy but no schema | Confirm with engineering team whether defect tracking is out-of-scope or planned |
| No user invitation flow in app routes | `workspace_members.status = 'invited'` exists in schema but no invite send/accept UI found | Search for planned invite routes or check if invitation is DB-only for now |
| No analytics tracking code | Cannot verify any KPIs; A/B testing and funnel analysis not possible | Confirm whether analytics is deliberately deferred or will be added |
| No CI/CD pipeline in `.github/workflows/` | No automated test gate; production quality relies on manual Vercel deploys | Confirm CI/CD roadmap; this is a HIGH-priority QA risk |
| Plan tier enforcement absent | Cloud/enterprise differentiation has no code implementation | Confirm monetization timeline; needed before billing integration testing |
| Full-text search UI absent | `tsv` GIN index exists but no search bar found in `AtcTable` or other UI | Confirm whether FTS endpoint/UI is planned (index is ready, query layer missing) |
| n8n env vars with no usage | Unknown automation surface; could represent webhook integration or notification pipeline | Ask engineering: what workflow does n8n serve in the planned architecture? |

---

## 7. QA Relevance

### Critical Testing Areas

| Area | Why Critical | Test Type |
|---|---|---|
| Magic-link auth flow (happy + error paths) | Only auth mechanism; GitHub/Google OAuth disabled | E2E |
| Workspace bootstrap RPC (slug uniqueness, owner assignment) | `bunkai_bootstrap_workspace` is atomic; failure rolls back both rows | E2E + API |
| ATC anchoring enforcement (≥1 AC required) | Core product invariant — "anchoring moat" | E2E + API |
| `bunkai_save_atc` atomicity (version bump, full replace of steps/assertions/ACs) | Single-transaction guarantee must not partially apply | API |
| PAT lifecycle (issue → use → revoke → reject) | `run:execute` scope critical for CI integration | API |
| RLS workspace isolation (cross-workspace data leakage) | Multi-tenant security boundary | API (security) |
| Module tree depth limit (max 6) | DB CHECK constraint — depth-7 must fail | API |

### Risk Areas

| Risk | Severity | Notes |
|---|---|---|
| No `data-testid` attributes on UI components | HIGH | Playwright locator strategy must be established before any UI E2E tests |
| Monaco Editor in shadow DOM | HIGH | `@monaco-editor/react` requires `evaluate()` or shadow DOM piercing in Playwright |
| Magic link auth in E2E tests | HIGH | No password fallback; test setup requires Supabase admin client session injection |
| No CI/CD gate | HIGH | Regressions go undetected until manual testing |
| Revoked PAT must return 401 uniformly | MEDIUM | Verify constant-time hash compare + uniform error response |

---

## 8. Document References

| Document | Path | Status |
|---|---|---|
| Executive Summary (this doc) | `.context/PRD/executive-summary.md` | Complete |
| User Personas | `.context/PRD/user-personas.md` | Complete |
| User Journeys | `.context/PRD/user-journeys.md` | Complete |
| Business Model | `.context/business/business-model.md` | Complete (Phase 1) |
| Domain Glossary | `.context/business/domain-glossary.md` | Complete (Phase 1) |
| Business Data Map | `.context/business/business-data-map.md` | Complete (Phase 1+3) |
| Backend Infrastructure | `.context/infrastructure/backend.md` | Complete (Phase 3) |
| Frontend Infrastructure | `.context/infrastructure/frontend.md` | Complete (Phase 3) |
| Project Config | `.context/project-config.md` | Complete (Phase 1) |
