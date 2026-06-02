# Infrastructure Overview

> Project: Bunkai TMS
> Generated: 2026-05-25
> Source: /project-discovery Phase 3 - Infrastructure

---

## Overview

```
Developer
  |-- bun install + bunx next dev --> localhost:3000 (Next.js dev)
  |-- git push (main)             --> GitHub --> Vercel Build --> upexbunkai.vercel.app
  |-- git push (staging branch)   --> GitHub --> Vercel Build --> staging-upexbunkai.vercel.app
  |
  +-- supabase start              --> Local Supabase (Docker, port 54321)

localhost:3000
  +-- NEXT_PUBLIC_SUPABASE_URL    --> Local Supabase (port 54321)

staging-upexbunkai.vercel.app
  +-- NEXT_PUBLIC_SUPABASE_URL    --> Supabase Cloud (staging project)

upexbunkai.vercel.app
  +-- NEXT_PUBLIC_SUPABASE_URL    --> Supabase Cloud (production project)
```

---

## CI/CD

| Aspect | Status |
|---|---|
| CI pipeline | NONE — no `.github/workflows/` directory exists |
| CD pipeline | Vercel automatic deployments (git push triggers) |
| PR checks | NONE — no automated checks on pull requests |
| Type check on push | Manual only (`bun run types:check` in pre-push hook) |
| Test automation on push | NONE |

> **Discovery Gap (HIGH):** No CI pipeline configured. All quality gates are local-only (Husky pre-commit/pre-push hooks). First CI job recommended: lint + typecheck + smoke suite on every PR.

---

## Deployment Configuration

| Setting | Value | Source |
|---|---|---|
| Platform | Vercel | Inferred from `lib/urls.ts` Vercel system env vars (`VERCEL_ENV`) |
| Build command | `next build` (Vercel default for Next.js) | No `vercel.json` to override |
| Output | Next.js serverless functions (default) | No `output: 'standalone'` in `next.config.ts` |
| Preview deployments | Likely enabled (Vercel default per-PR) | No `vercel.json` to disable |
| `vercel.json` | Not present | No custom routing, headers, or redirects configured |
| Environment detection | `process.env.VERCEL_ENV` | `lib/urls.ts` — `production` / `preview` / absent |

**Environment URL mapping (from `lib/urls.ts`):**

```typescript
export const APP_URLS = {
  local:      'http://localhost:3000',
  staging:    'https://staging-upexbunkai.vercel.app',
  production: 'https://upexbunkai.vercel.app',
};

// VERCEL_ENV === 'production'  -> production
// VERCEL_ENV === 'preview'     -> staging
// absent (local dev)           -> local
```

---

## Environments Matrix

| Environment | URL | Branch | Auto Deploy | Database |
|---|---|---|---|---|
| Local | `http://localhost:3000` | — | — | Local Supabase (Docker, port 54321) |
| Staging | `https://staging-upexbunkai.vercel.app` | `staging` or PR previews | Yes (Vercel) | Supabase Cloud — staging project (assumed separate) |
| Production | `https://upexbunkai.vercel.app` | `main` | Yes (Vercel) | Supabase Cloud — production project |

> **Note:** Staging/production DB separation is assumed but not verified from code. Both environments set `NEXT_PUBLIC_SUPABASE_URL` as Vercel environment variables — confirm in Vercel dashboard.

---

## Secrets Management

| Secret Category | Storage | Access Scope | Notes |
|---|---|---|---|
| App secrets (prod) | Vercel environment variables | Production deployments | Set via Vercel dashboard |
| App secrets (staging) | Vercel environment variables | Preview deployments | Set via Vercel dashboard |
| Local dev secrets | `.env.local` (gitignored) | Local process only | `.env.example` as template |
| Secret manager | None | — | No Vault, Doppler, or AWS Secrets Manager found |

**Required secrets per environment:**

| Secret | Local | Staging | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local Supabase URL | Staging Supabase project URL | Production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local anon key | Staging anon key | Production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Local service key | Staging service key | Production service key |
| `RESEND_API_KEY` | Test key | Staging key | Production key |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Staging URL | Production URL |

---

## Cloud Services

| Service | Provider | Purpose | Tier / Plan |
|---|---|---|---|
| Next.js App Hosting | Vercel | FE + API (serverless functions) | Unknown |
| Database | Supabase | PostgreSQL + RLS + Auth + Realtime | Unknown |
| Authentication | Supabase Auth | Magic link OTP sessions | Included in Supabase |
| Email (transactional) | Resend | Magic link delivery | Unknown |
| Workflow automation | n8n | Unknown — env vars present, no code usage found | Unknown (Discovery Gap) |

---

## Infrastructure Resources Diagram

```
Browser
  |
  v
Vercel CDN + Edge
  |
  v
Next.js Serverless Functions (app/api/v1/*)
  |
  +-- Supabase Postgres (PostgREST + RLS)
  |     Tables: workspaces, workspace_members, projects, modules,
  |             user_stories, acceptance_criteria, atcs, atc_steps,
  |             atc_assertions, access_tokens
  |
  +-- Supabase Auth
  |     Magic link OTP -> session cookie -> middleware.ts refresh
  |
  +-- Resend Email API
        Magic link email delivery

Browser (auth flow)
  |
  +-- GET /auth/callback?code=...
  +-- Session stored as HttpOnly cookie (SSR-compatible)
  +-- All subsequent requests: cookie auto-refreshed by middleware.ts
```

---

## Monitoring and Observability

| Concern | Tool | Status |
|---|---|---|
| Error tracking | None | Discovery Gap |
| Uptime monitoring | None | Discovery Gap |
| Application logging | Vercel function logs (built-in) | Available in Vercel dashboard |
| API request logging | `lib/api/logging.ts` + `lib/api/request-id.ts` | Request ID + logging helpers in app code |
| Performance monitoring | None | Discovery Gap |
| Core Web Vitals | None | Discovery Gap |

---

## Rollback Procedure

**Application (Vercel):**

```
1. Open Vercel dashboard: https://vercel.com/<org>/upex-bunkai-tms/deployments
2. Find last known-good deployment
3. Click "..." menu -> "Redeploy" (or use Vercel CLI: vercel rollback <deployment-url>)
4. Production traffic switches to previous deployment in ~30s
```

No `vercel.json` rollback config found. Rollback is manual via Vercel dashboard.

**Database (Supabase):**

```
1. Supabase point-in-time recovery (if enabled on plan)
2. Manual: run down-migrations (no down migration files found — Discovery Gap)
3. Last resort: restore from Supabase backup
```

> **Note:** No `down` migration files exist in `supabase/migrations/`. All 8 migrations are up-only. Rollback requires manual SQL or Supabase backup restore.

---

## QA Relevance

| Infrastructure Concern | Test Implication |
|---|---|
| Vercel serverless cold starts | API timeout tests — first request may be slow; avoid hardcoded 2s waits |
| Supabase RLS on all tables | Multi-tenant isolation tests — verify user A cannot read user B's ATCs/workspaces |
| Magic link auth only | Test fixture must bypass email — inject session via Supabase admin client or cookie |
| No CI pipeline | First CI job = lint + typecheck + smoke suite on every PR (Phase 6 deliverable) |
| `VERCEL_ENV` detection | Staging tests hit `https://staging-upexbunkai.vercel.app` — separate DB from production |
| `bk_pat_*` bearer tokens | API tests use PAT auth — POST `/api/v1/tokens` to get token, inject as Bearer |
| No `data-testid` on components | All Playwright locators need role/label/text selectors until `data-testid` established |
| PAT scopes enforced | Test scope boundaries — `atc:read` cannot call `atc:write` endpoint |
| Soft-delete for tokens | Revoked tokens return 401 — test revocation flow explicitly |

---

## Discovery Gaps

| Gap | Severity | Notes |
|---|---|---|
| No CI/CD pipeline | HIGH | No `.github/workflows/` — manual deploys only; first CI job is Phase 6 deliverable |
| No error tracking (Sentry/Rollbar) | MEDIUM | Errors surface only in Vercel function logs; no alerting |
| No `vercel.json` config | LOW | No custom routing, headers, redirects, or function config |
| n8n integration purpose | LOW | `N8N_API_URL` + `N8N_API_KEY` in `.env.example`; zero usage found in app code |
| Staging/prod DB separation | MEDIUM | Assumed separate Supabase projects; not verified from code — confirm in Vercel dashboard |
| No down-migrations | MEDIUM | 8 up-only migrations; database rollback requires manual SQL or backup restore |
| Uptime monitoring | LOW | No uptime checks configured |
| Vercel plan / limits | LOW | Serverless function timeout, concurrency limits, bandwidth unknown |
| `VERCEL_ENV === 'preview'` maps to staging | LOW | All PR previews use staging URL/DB — potential data contamination if multiple PR previews run simultaneously |
