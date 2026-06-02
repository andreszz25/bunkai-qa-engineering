# Frontend Infrastructure

> Project: Bunkai TMS
> Generated: 2026-05-25
> Source: /project-discovery Phase 3 - Infrastructure

---

## Build Configuration

| Setting | Value | Source |
|---|---|---|
| Framework | Next.js 15.5.18 (App Router) | `bun.lock` + `next.config.ts` |
| Router | App Router (`app/` directory) | Directory structure |
| Bundler | Webpack (default) + SWC compiler | `next.config.ts` (no Turbopack flag) |
| Output | Default (no `output: 'standalone'`) | `next.config.ts` |
| TypeScript | Strict mode | `tsconfig.json` `"strict": true` |
| Typed Routes | `typedRoutes: true` | `next.config.ts` |
| React Strict Mode | `reactStrictMode: true` | `next.config.ts` |
| Output file tracing root | `path.resolve(import.meta.dirname)` | `next.config.ts` |
| Image remote patterns | None configured | `next.config.ts` `images.remotePatterns: []` |
| CSS post-processing | Tailwind CSS + Autoprefixer | `postcss.config.js` |

---

## Next.js Config (key settings)

```typescript
// next.config.ts
const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  typedRoutes: true,
  images: {
    remotePatterns: [],
  },
};
```

---

## Client Environment Variables

All `NEXT_PUBLIC_*` vars are inlined into the browser bundle at build time by Next.js.

| Variable | Example Format | Purpose | Environments |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase project URL | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (JWT) | Supabase publishable key | All |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Auth redirect base URL | All |

> `NEXT_PUBLIC_*` vars accessed via static `process.env.NEXT_PUBLIC_*` in `lib/supabase/client.ts` and `middleware.ts`. Dynamic access (e.g. `process.env[name]`) resolves to `undefined` in browser builds — Next.js limitation.

---

## Static Assets

| Asset | Path | Purpose |
|---|---|---|
| `openapi.json` | `public/openapi.json` | Committed OpenAPI spec (regenerated via `bun scripts/openapi-gen.ts`) |

> `public/` contains only `openapi.json` — no images, fonts, or static files beyond the OpenAPI spec.

---

## Fonts

Three Google Fonts loaded via `next/font/google` in `app/layout.tsx`:

| Font | Weights | CSS Variable | Usage |
|---|---|---|---|
| Inter | All (auto) | `--font-inter` | Primary sans-serif UI font |
| JetBrains Mono | All (auto) | `--font-jetbrains-mono` | Monospace (code, ATC steps, tokens) |
| Noto Serif JP | 600, 700 | `--font-noto-serif-jp` | Japanese character branding (Bunkai wordmark) |

Tailwind font family aliases in `tailwind.config.ts`:
- `font-sans` → `var(--font-sans)` (Inter)
- `font-mono` → `var(--font-mono)` (JetBrains Mono)
- `font-jp` → `var(--font-jp)` (Noto Serif JP)

---

## Routing Structure

```
app/
├── (app)/                        # Protected route group (require auth)
│   ├── layout.tsx                # Protected layout wrapper
│   ├── onboarding/               # New user onboarding wizard
│   │   ├── page.tsx              # Onboarding wizard page
│   │   └── onboarding-form.tsx   # Wizard form component
│   └── projects/                 # Project list + ATC editor
│       ├── page.tsx              # Projects list page
│       └── [projectSlug]/        # Dynamic project route
│           └── atcs/             # ATCs for project
│               ├── page.tsx      # ATC list page
│               └── [atcId]/      # Dynamic ATC editor
│                   └── (actions, page, components)
├── (auth)/                       # Public auth route group
│   └── login/                    # Magic link login
│       ├── page.tsx              # Login page
│       └── magic-link-form.tsx   # Email form component
├── auth/
│   └── callback/                 # OTP exchange callback
│       └── route.ts              # GET handler (code -> session)
├── api/
│   ├── docs/                     # Interactive Scalar API docs
│   │   └── page.tsx
│   ├── openapi/                  # OpenAPI JSON endpoint
│   │   └── route.ts
│   └── v1/                       # REST API handlers
│       ├── health/               # Liveness probe
│       ├── auth/magic-link/      # Magic link initiation
│       └── tokens/               # PAT management
│           └── [id]/             # Token revocation
├── design-tokens/                # Internal design token reference page
├── globals.css                   # Global CSS + CSS custom properties
├── layout.tsx                    # Root layout (fonts, Toaster, dark class)
└── page.tsx                      # Root redirect (to /login or /projects)
```

**Route group auth enforcement (via `middleware.ts`):**

| Prefix | Access | Redirect on fail |
|---|---|---|
| `/projects`, `/onboarding` | Protected — cookie session required | → `/login?next=<path>` |
| `/login`, `/auth`, `/api/auth` | Public — always accessible | — |
| All others | Pass-through — no enforcement | — |

---

## State Management

| Concern | Solution | Notes |
|---|---|---|
| Auth state | `@supabase/ssr` + cookie session | SSR-compatible; session auto-refreshed in middleware |
| Server data | React Server Components (RSC) | `createClient()` (server) fetches data directly |
| Client auth state | `@supabase/supabase-js` browser client | Per-tab singleton in `lib/supabase/client.ts` |
| Table state | `@tanstack/react-table` 8.21 | ATC list data grid |
| Code editor state | Monaco Editor 4.7 | ATC step authoring |
| Form state | React 19 built-in (`useState`) | Login form, onboarding wizard |
| Toasts / notifications | Sonner 2.0 | Mounted in root layout |
| Command palette | `cmdk` 1.1 | Global command palette |

---

## Test Integration Points

| Concern | Selector Strategy | Notes |
|---|---|---|
| Login form (email input) | Role/label selectors (`getByRole`, `getByLabelText`) | No `data-testid` found — Discovery Gap |
| Magic link auth | Intercept Supabase `signInWithOtp` or inject session cookie directly | Browser flow requires email — test must bypass via API or cookie injection |
| Session setup | `supabase.auth.setSession()` or direct DB token insertion | Recommended: use Supabase admin client to create session in test setup |
| ATC editor (Monaco) | Monaco-specific selectors or keyboard events | Monaco renders in shadow DOM — requires `evaluate` or specialized locators |
| Project navigation | URL-based (`page.goto('/projects')`) | After auth setup, navigate directly |
| Toast assertions | `getByText()` with Sonner toast container | Toast container in root layout |
| Data teardown | Supabase admin client `DELETE` or DB reset | RLS-scoped — use service role key in test teardown |

> **No `data-testid` attributes found in component code.** Must be established during `/adapt-framework` before writing Playwright tests.

---

## Design System

### Tailwind Configuration

The app uses a CSS custom properties (CSS variables) based theme system — all color tokens defined as `var(--token-name)` in `globals.css`.

**Color palette categories:**

| Category | Token pattern | Role |
|---|---|---|
| Surfaces | `surface-0` to `surface-5` | Background layers (dark) |
| Foreground | `fg-0` to `fg-4` | Text contrast tiers |
| Strokes | `stroke-1` to `stroke-strong` | Borders / dividers |
| Accent | `accent`, `accent-hi`, `accent-glow`, `accent-soft` | Primary vermillion accent |
| Signal | `signal-pass`, `signal-fail`, `signal-blocked`, `signal-skipped`, `signal-running` | Test status colors |
| Layer chips | `layer-ui`, `layer-api`, `layer-unit` | ATC layer type indicators |

Dark-first design: root HTML element has `class="dark"` set in `app/layout.tsx`.

**Custom typography scale** (compact, dense UI):

| Token | Size | Usage |
|---|---|---|
| `text-2xs` | 10.5px | Micro labels |
| `text-xs` | 11px | Secondary metadata |
| `text-sm` | 12px | Body small |
| `text-base` | 13px | Default body |
| `text-md` | 14px | Emphasized body |
| `text-lg` | 16px | Headings |

### shadcn/ui Components

Style: `new-york`, base color: `neutral`, CSS variables: `true`.

| Component | File | Usage |
|---|---|---|
| Button | `components/ui/button.tsx` | CTAs, form submissions |
| Card | `components/ui/card.tsx` | Content panels |
| Input | `components/ui/input.tsx` | Form fields |
| Label | `components/ui/label.tsx` | Form labels |

Additional Radix UI primitives used directly (not all listed in `components/ui/`): Dialog, DropdownMenu, Tabs, Tooltip.

### Monaco Editor Integration

Used in ATC step editor (`app/(app)/projects/[projectSlug]/atcs/[atcId]/`). Monaco renders as a client component — SSR incompatible, must be `'use client'` or loaded with `dynamic(() => import(...), { ssr: false })`.

---

## Performance Configuration

| Concern | Setting | Notes |
|---|---|---|
| React Strict Mode | `reactStrictMode: true` | Double-invokes effects in dev — `createClient()` has per-tab singleton guard |
| Image optimization | `next/image` available | No remote patterns configured; local images not in `public/` |
| Font optimization | `next/font/google` with `display: 'swap'` | FOUT-safe; fonts auto-subset |
| Code splitting | Automatic (Next.js App Router) | Route segments loaded on demand |
| Output file tracing | `outputFileTracingRoot` set | Ensures monorepo-style deployments capture all deps |
| Bundle analyzer | Not configured | Discovery Gap |
| Core Web Vitals | Not measured | Discovery Gap |

---

## Git Hooks (Husky)

| Hook | Commands | Purpose |
|---|---|---|
| `pre-commit` | `bunx lint-staged` + `tsc --noEmit` + `bun run vars:check` + `bun run skills:check` + conditional `skills:registry:check` | Quality gate on every commit |
| `pre-push` | `bun run repo:check` (format + lint + types + vars + skills + registry) | Full health check before push |

`lint-staged` config: ESLint auto-fix on `*.{ts,tsx,js,jsx}`; Prettier on `*.{json,yml,yaml,css,scss,html}`.

---

## Discovery Gaps

| Gap | Severity | Notes |
|---|---|---|
| No `data-testid` attributes on UI components | HIGH | Must establish during `/adapt-framework` — all Playwright selectors need an anchor strategy |
| Magic link auth flow in tests | HIGH | Browser auth requires email intercept or session cookie injection — test fixture strategy TBD |
| Monaco Editor testability | MEDIUM | Monaco renders in shadow DOM — requires specialized Playwright interaction patterns |
| No bundle analyzer configured | LOW | No `@next/bundle-analyzer` or similar — bundle size not tracked |
| No Core Web Vitals measurement | LOW | No Lighthouse CI or web-vitals library integration |
| `public/openapi.json` not in `.gitignore` | LOW | Committed artifact — must be regenerated and committed after any route OpenAPI change |
| No E2E auth fixtures established | HIGH | No `storageState` or `auth.setup.ts` for Playwright — needed before any protected-route tests |
