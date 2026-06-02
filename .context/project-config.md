# Project Configuration

> Project: Bunkai (分解)  
> Generated: 2026-05-25  
> Source: /project-discovery Phase 1

## Repositories

| Repository | Path | Branch | Purpose |
|---|---|---|---|
| upex-bunkai-tms | //wsl.localhost/Ubuntu/home/andreszz25/upex/upex-bunkai-tms | main | Full-stack TMS app (FE + BE in single Next.js repo) |

## Tech Stack

### Frontend
- Framework: Next.js 15 (App Router, `typedRoutes: true`)
- Language: TypeScript 5.9.3
- Styling: Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives)
- State: Supabase client hooks (`@supabase/ssr` 0.10.3) + React 19 built-in state
- Components: shadcn/ui (`components/ui/`) — Radix Dialog, DropdownMenu, Tabs, Tooltip
- UI extras: TanStack React Table 8.21 (data grids), Monaco Editor 4.7 (ATC step editor), cmdk 1.1 (command palette), Sonner 2.0 (toast), Lucide React 1.16 (icons)

### Backend
- Framework: Next.js 15 App Router (API Route Handlers under `app/api/v1/`)
- Language: TypeScript 5.9.3
- ORM: None — Supabase client (`@supabase/supabase-js` 2.106) used directly
- Auth: Supabase Auth (magic link → `/auth/callback` → SSR cookie session via `middleware.ts`)
- Validation: Zod 4.4.3 (runtime schemas) + `@asteasolutions/zod-to-openapi` 8.5 (OpenAPI generation)

### Database
- Type: PostgreSQL
- Provider: Supabase (managed)
- Access (staging): `staging-dbhub` (MCP server name from `.agents/project.yaml`)
- Access (local): `local-dbhub`
- Migrations: `supabase/migrations/` (8 migration files, authoritative schema)
- RLS: Enabled on all tables; helper functions `bunkai_is_workspace_member`, `bunkai_can_write_workspace`, `bunkai_is_workspace_admin`, `bunkai_is_workspace_owner`

### Infrastructure
- Cloud: Vercel (Next.js serverless functions)
- DB: Supabase managed PostgreSQL
- CI/CD: NONE — no `.github/workflows/` exists (Discovery Gap — HIGH priority)
- Monitoring: None detected (Discovery Gap)

## API Contract
- OpenAPI spec: `/api/openapi.json` (auto-generated at runtime from Zod schemas via `@asteasolutions/zod-to-openapi`)
- OpenAPI registry: `lib/openapi/registry.ts`
- Route OpenAPI declarations: `app/api/v1/**/*.route.openapi.ts` (co-located)
- Technical types: `api/openapi-types.ts` (generate via `bun run api:sync`)
- Interactive docs: `app/api/docs/` (served via `@scalar/api-reference-react`)

## Environments

| Key | Local | Staging |
|---|---|---|
| `web_url` | `http://localhost:3000` | `https://staging-upexbunkai.vercel.app` |
| `api_url` | `http://localhost:3000/api` | `https://staging-upexbunkai.vercel.app/api` |
| `db_mcp` | `local-dbhub` | `staging-dbhub` |
| `api_mcp` | `local-openapi` | `staging-openapi` |

Source: `//wsl.localhost/Ubuntu/home/andreszz25/upex/bunkai-qa-engineering/.agents/project.yaml`

Active test environment: `staging` (default — `testing.default_env`)

## Tools and Access

| Tool | Details |
|---|---|
| Issue tracker | Jira — project key: `BK` — site: `https://upexgalaxy67.atlassian.net/` |
| Issue tracker CLI | `acli` |
| Test management | `bun xray` (Xray Cloud) |
| Database (staging) | `staging-dbhub` MCP |
| Database (local) | `local-dbhub` MCP |
| API (staging) | `staging-openapi` MCP |
| API (local) | `local-openapi` MCP |

## Access Checklist

- [x] Repository read access (local clone at `//wsl.localhost/Ubuntu/home/andreszz25/upex/upex-bunkai-tms`)
- [ ] Database access — MCP `staging-dbhub` (verify `.env` has `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`)
- [x] Issue tracker access (Jira BK project, acli configured, `ATLASSIAN_URL` + `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN` required)
- [ ] Staging environment reachable (`https://staging-upexbunkai.vercel.app` — not verified during discovery)
- [ ] CI/CD visibility — NONE configured (no `.github/workflows/`)

## Environment Variables Required

Key names only (never paste values). Source: `upex-bunkai-tms/.env.example`

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase admin client (bypasses RLS) |
| `SUPABASE_ACCESS_TOKEN` | MCP | Supabase MCP control-plane token |
| `NEXT_PUBLIC_APP_URL` | Client + Server | Auth redirect base URL |
| `ATLASSIAN_URL` | CLI/MCP | Atlassian site base URL |
| `ATLASSIAN_EMAIL` | CLI/MCP | Atlassian account email |
| `ATLASSIAN_API_TOKEN` | CLI/MCP | Atlassian API token |
| `TAVILY_API_KEY` | MCP | Tavily web search MCP |
| `N8N_API_URL` | MCP | n8n automation instance URL |
| `N8N_API_KEY` | MCP | n8n API key |
| `RESEND_API_KEY` | App | Transactional email (magic link delivery) |

## Discovery Gaps

| Gap | Severity | Notes |
|---|---|---|
| No CI/CD pipeline | HIGH | No `.github/workflows/` exists; manual deployments only |
| Staging URL not verified live | MEDIUM | Discovery was read-only; URL found in `project.yaml` |
| N8N integration env vars present but purpose unclear | LOW | `N8N_API_URL` + `N8N_API_KEY` in `.env.example`; no usage found in app code during discovery |
| No `data-testid` attributes on UI components | MEDIUM | Needs establishment during `/adapt-framework` |
| `SUPABASE_PUBLISHABLE_KEY` vs `NEXT_PUBLIC_SUPABASE_ANON_KEY` naming inconsistency | LOW | `.env.example` uses `SUPABASE_PUBLISHABLE_KEY`; `env.ts` validates `NEXT_PUBLIC_SUPABASE_ANON_KEY`; confirm correct key name |
