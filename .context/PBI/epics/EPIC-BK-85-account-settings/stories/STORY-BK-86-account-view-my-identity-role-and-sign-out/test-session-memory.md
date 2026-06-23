# BK-86 — Test Session Memory

## TMS Modality

**jira-native** — Xray credentials commented out in `.env`; Test issue type exists as native Jira.
ATP field: `customfield_10067` (mapped). ATR field: NOT mapped → fallback comment.
Stage 1: TC **outlines only** (no `Test` work items).
Stage 4: create `Test` work items for regression-worthy TCs only.

## Ticket Summary

| Field | Value |
|---|---|
| Key | BK-86 |
| Title | Account \| View my identity, role, and sign out |
| Type | Story |
| Status | Ready For QA |
| Priority | Medium |
| Epic | BK-85 (Account & Settings) |
| Story Points | 3 |
| Labels | `shift-left-2026-06-08`, `shift-left-reviewed` |

## Acceptance Criteria (7 scenarios)

1. **Scenario 1** — Signed-in identity visible from any screen (initials from email, email + role on open)
2. **Scenario 2** — Sign out ends session server-side, redirects to sign-in, blocks back-nav
3. **Scenario 3** — Account menu keyboard accessible (open, Escape close, focus return)
4. **New Scenario A** — Role display updates on workspace switch
5. **New Scenario B** — No-workspace user sees empty-state placeholder
6. **New Scenario C** — Sign-out failure surfaced, session preserved
7. **New Scenario D** — Multi-tab sign-out propagation

## Environment

| Var | Value |
|---|---|
| WEB_URL | `https://staging-upexbunkai.vercel.app` |
| API_URL | `https://staging-upexbunkai.vercel.app/api` |
| DB_MCP | `staging-dbhub` |
| API_MCP | `staging-openapi` |

## TMS Artifacts

| Artifact | Location | ID |
|---|---|---|
| ATP | Story `customfield_10067` | BK-86 (field) |
| ATR | Fallback comment `## Acceptance Test Results (ATR)` | BK-86 (comment, pending) |
| TCs | Outlines only (jira-native — work items in Stage 4) | 12 outlines |

## Stage Progress

| Stage | Status | Timestamp |
|---|---|---|
| Session Start | COMPLETED | 2026-06-23 |
| Stage 1 — Planning | COMPLETED | 2026-06-23 |
| Stage 2 — Execution | PENDING | — |
| Stage 3 — Reporting | PENDING | — |

## Stage 2 Results

### Code Exploration vs Reality
Code exploration (pre-deploy snapshot) was OUTDATED. Deployed staging shows:
- Role field EXISTS as `active_workspace_role` top-level in `/api/v1/me` response
- UI shows "Owner" in sidebar account block — role IS displayed
- ARIA: `haspopup="menu"`, `aria-expanded`, `role="menu"`, `role="menuitem"` all present
- Escape closes menu + focus returns to trigger
- Sign-out: `POST /auth/v1/logout?scope=global` → 204 (server-side invalidation works)

### TC Execution Results

| TC | Title | Result | Evidence | Notes |
|---|---|---|---|---|
| TC-01 | Initials visible on every page | **PASS** | smoke-projects-page.png | "BS" on /projects and /projects/[slug]. /onboarding redirects (user has workspace) — N/A for this user |
| TC-02 | Email + role on menu open | **PASS** | smoke-account-menu-open.png | "SIGNED IN AS" + full email + "Owner". API: `active_workspace_role: "owner"` → "Owner" |
| TC-03 | Never display another user's data | **NOT TESTED** | — | Needs second test account — data generation required |
| TC-04 | Role updates on workspace switch | **NOT TESTED** | — | Needs multi-workspace with different roles |
| TC-05 | No-workspace empty state | **NOT TESTED** | — | Needs user with zero memberships |
| TC-06 | Sign-out: server-side + redirect + back-nav | **PASS WITH ISSUES** | signout-redirect-to-login.png | Server-side invalidation ✓ (204). **BUG**: client-side redirect does NOT fire after sign-out — page stays on /projects until manual reload. After reload → /login?next=/projects ✓. Back-nav blocking works after reload. |
| TC-07 | Sign-out failure surfaced | **NOT TESTED** | — | Needs network interception (Playwright route mock) |
| TC-08 | Multi-tab sign-out propagation | **NOT TESTED** | — | Needs multi-tab test setup |
| TC-09 | No duplicate sign-out on rapid click | **PASS** | — | Button shows "Signing out…" + disabled during request → prevents double-click |
| TC-10 | Keyboard: Escape close + focus return | **PASS** | — | Escape closes menu, focus returns to trigger button (verified via a11y tree) |
| TC-11 | Focus trap within menu | **NOT TESTED** | — | Needs Tab cycling verification with only 1 menuitem |
| TC-12 | ARIA semantics | **PASS** | — | trigger: `aria-haspopup="menu"`, `aria-expanded="false"/"true"`, `title=email`. Menu: `role="menu"`. Item: `role="menuitem"`. Missing: `aria-label` on trigger (has `title` instead) |

### Bugs Found

**BUG-1 (Non-blocking, Medium severity)**:
- **Summary**: Sign-out does not redirect to /login — client-side router.push fails silently
- **Repro**: Login → Open account menu → Click "Sign out" → Observe: page stays on /projects, button reverts to "Sign out"
- **Expected**: Redirect to /login automatically
- **Actual**: No redirect. Server-side invalidation works (204). Reload → /login redirect works.
- **Network evidence**: `POST /auth/v1/logout?scope=global` → 204, `GET /login?_rsc=...` → 200 (RSC fetch), but no client-side navigation
- **Root cause hypothesis**: `router.push('/login')` fires after `signOut()` resolves but Next.js RSC router may not navigate when the middleware now rejects the request (stale session cookie still in browser state)
- **Blocking**: No — session IS invalidated server-side. UX issue, not security issue.

### Observations
- Initials "BS" = first letter of "bunkai" + first letter of "staging" (split on hyphens from email local-part `bunkai-staging-user`)
- 33 workspaces in this test account — rich data
- `active_workspace_role` is a NEW field not in the code I explored — implementation evolved post-code-exploration
- Sign-out button shows "Signing out…" disabled state — good idempotency guard (TC-09)
- ARIA is substantially complete — only missing `aria-label` (has `title` attribute instead, which is accessible but less standard for menu triggers)

## Stage 1 Results

- **Risk score**: 12 (HIGH)
- **TC count**: 12 outlines (5 P0, 6 P1, 1 P2)
- **Shift-left short-circuit**: applied (Phases 1-3 skipped)
- **Code exploration findings**: 7 implementation gaps identified (role field missing from /me, role not displayed, no multi-tab redirect, ARIA semantics absent, focus trap missing, workspace switch discards role, dead code UserMenu.tsx)
- **Data feasibility**: primary test user available; no-workspace user + multi-workspace setup may need generation
- **ATP written to Jira**: HTTP 204 OK
- **ATR placeholder**: posted as fallback comment

## Team Discussion Summary

- **PO (role-play)**: all 4 new scenarios confirmed in scope. Initials from email. Global chrome = all `(app)` routes including onboarding. Server-side invalidation + multi-tab = core, not optional. Role label = capitalize enum.
- **Dev (role-play)**: no `display_name` in schema, email local-part initials. Global chrome via promoting `Topbar` into `(app)/layout.tsx`. `supabase.auth.signOut()` already invalidates server-side. Multi-tab needs redirect handler in `AuthProvider` on `SIGNED_OUT`. Role field MISSING from `/api/v1/me` — hard prerequisite.
- **Design (role-play)**: initials chip (Inter font, `--bg-3`), place in Topbar `right` slot, dropdown follows `WorkspaceSwitcher` panel pattern, full ARIA `menu` pattern expected (not just Escape).
- **Automation (6/21)**: PR created + merged.
