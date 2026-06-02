# Shift-Left Refinement: BK-3
**Refined on**: 2026-05-26 | **QA mode**: Shift-Left pre-sprint
**Risk level**: HIGH | **Source spec**: FR-001 (OAuth portion)

---

## Critical Analysis (Phase 1)

### Implementation Feasibility

BK-3 is a **greenfield implementation** — zero OAuth code exists in the current codebase. All three layers of the OAuth flow must be built from scratch:

1. **UI layer**: Both OAuth buttons are hard-disabled (`disabled={true}`, `cursor-not-allowed`, `opacity-60`) with an explicit `title="OAuth ships next sprint"` tooltip. Login copy reads "OAuth and SSO ship next sprint." Dev must enable these buttons and wire `onClick` handlers.

2. **Client layer**: `auth-context.tsx` exposes only `signInWithMagicLink` and `signOut`. No `signInWithOAuth` method or any Supabase OAuth initiation call exists anywhere in the codebase. The entire client-side OAuth initiation flow must be added.

3. **Server layer**: `app/auth/callback/route.ts` is documented as "Magic-link OTP exchange handler" and handles only magic-link code exchange. It performs no state-parameter validation, no provider-specific handling, and defaults redirect to `/projects` — not `/home` as specified in the AC. The callback route must be extended or a dedicated OAuth callback route created.

**Assessment**: This story carries HIGH implementation risk. Dev effort is substantial and touches auth-critical code. Pre-sprint clarification on the three implementation gaps (G8–G10) is mandatory before sprint commitment.

---

## Story Quality Analysis (Phase 2)

### AC Completeness Audit

The original 5 Gherkin scenarios cover the primary happy paths and top 3 failure modes. However, they leave critical gaps in: returning user behavior, cross-provider email collision, workspace bootstrap failure handling, rate limiting, and session persistence semantics. The AC set is **insufficient for sprint commitment without the additions documented in Phase 3**.

---

### Ambiguities Found

| # | Question | Impact |
|---|---|---|
| A1 | "User lands on Workspace Home with status 201" — HTTP 201 applies to resource creation; a page redirect returns 302/200. Should this be interpreted as workspace creation returning 201 from the API, not the browser redirect? | AC is literally untestable as written against the browser redirect |
| A2 | "User row is upserted in auth.users with provider=github" — Supabase manages `auth.users` directly; QA has no direct visibility into this table in staging. Is there an observable API response, UI indicator, or accessible log that confirms the upsert? | No testable assertion mechanism defined |
| A3 | The scope states "magic-link fallback surfaced when OAuth callback fails within 30s" but the cookie-restriction scenario specifies "popup fails to set a cookie within 30s." Does the 30s timer start at button click, at provider redirect, or at callback arrival? | Directly affects test setup and timing assertions |
| A4 | "Second attempt rejected with EMAIL_EXISTS" — is this surfaced in the UI (toast, error page, error code in URL), returned as an API error, or silently dropped? The AC set has no EMAIL_EXISTS scenario defined. | No acceptance criteria exist for this business rule |
| A5 | "Default workspace created" on first login — what is the observable evidence of workspace creation? Is the user redirected to a workspace-specific URL (e.g. `/workspaces/{slug}/home`), shown a workspace name in the header, or is workspace existence verifiable only via DB? | ATP cannot assert workspace creation without knowing the observable signal |

---

### AC Gaps Found

| # | Missing AC | Risk if omitted |
|---|---|---|
| G1 | Returning OAuth user (already has account) sign-in — no scenario for subsequent logins post-registration | Dev may gate workspace creation behind a flag that breaks returning users |
| G2 | EMAIL_EXISTS scenario — business rule #3 defines rejection behavior but no AC encodes the user-facing error for this case | Feature ships without a tested state; user sees silent failure or unhandled exception |
| G3 | Workspace bootstrap failure — what happens if the default workspace creation fails (DB constraint, RLS error, network timeout) after successful OAuth? Does the user land on an error screen or a broken home? | Auth succeeds but user is orphaned without a workspace — high-severity UX failure |
| G4 | Session persistence after OAuth — is the session cookie `httpOnly`, `secure`, `SameSite=Lax`? What is the session TTL? Does the session survive a page refresh? | Security and UX regression risk post-implementation |
| G5 | OAuth initiation failure — what if the redirect to GitHub/Google itself fails (provider down, network error)? Is there a user-visible error state, or does the UI hang? | No fallback defined for the outbound redirect failure case |
| G6 | Rate limiting on OAuth callback — repeated failed callbacks (e.g. CSRF probing) — is there a lockout or rate-limit response defined? | Security gap; no coverage for brute-force state-token probing |
| G7 | Account linking — can an OAuth user later link a second provider (e.g. sign up via GitHub, then link Google)? Scope says "manual linking by support in MVP" — but what does the user see when they attempt self-service linking? | User confusion if the UI suggests linking is possible but it is not |
| G8 | OAuth callback route — `app/auth/callback/route.ts` handles only magic-link; no OAuth handler exists. A dedicated OAuth route or route adaptation is required. AC must specify which route handles OAuth callbacks. | Without this, callback step 4 in the workflow has no server handler |
| G9 | OAuth client initiation — no `signInWithOAuth` call exists in the codebase. AC must specify the expected provider scopes (email, profile), redirect URI, and PKCE vs. implicit flow configuration. | Entire OAuth initiation flow is unimplemented |
| G10 | OAuth button `onClick` — buttons in `app/(auth)/login/page.tsx` have no `onClick` handler. AC must confirm the button enables and triggers the correct OAuth provider. | UI entry point is non-functional; BK-3 cannot be tested manually or automated |

---

### Contradictions Found

| # | Contradiction |
|---|---|
| C1 | AC states "user lands on Workspace Home" and the workflow says "redirect to `/home`" — but `app/auth/callback/route.ts` currently redirects to `/projects`. The redirect target must be aligned between AC and implementation before Dev starts. |
| C2 | Login page copy says "OAuth ships next sprint" and OAuth buttons are `disabled={true}` — these UI states directly conflict with BK-3 being in scope for this sprint. Dev must update both the button state and the copy as part of this ticket. |

---

### Implementation Gaps (NEW — from codebase)

| # | Gap | File | Risk |
|---|---|---|---|
| G8 | Callback route handles magic-link OTP only; no OAuth state validation, no provider handling, redirect goes to `/projects` not `/home` | `app/auth/callback/route.ts` | OAuth callback will either 404 or misroute without a dedicated handler |
| G9 | No `signInWithOAuth` method or Supabase OAuth call anywhere in codebase; `auth-context.tsx` exposes only `signInWithMagicLink` + `signOut` | `components/providers/auth-context.tsx` | OAuth initiation has no client-side implementation |
| G10 | OAuth buttons have no `onClick` handler; buttons are `disabled={true}` with `cursor-not-allowed` and explicit "ships next sprint" tooltip | `app/(auth)/login/page.tsx` lines 136–155 | UI entry point for OAuth is fully blocked; BK-3 cannot start without this change |

---

## Refined Acceptance Criteria (Phase 3)

> Scenarios marked **[NEEDS PO/DEV CONFIRMATION]** are inferred from business rules and codebase analysis; they require explicit PO or Dev sign-off before sprint start.

---

### AC-1: GitHub OAuth — First-Time Sign-Up (Happy Path)
```gherkin
Scenario: GitHub OAuth first-time sign-up
Given a visitor on the Sign-in screen
And the "Continue with GitHub" button is enabled and clickable
When they click "Continue with GitHub" and approve the OAuth consent on GitHub
Then Supabase Auth completes the code exchange using a valid CSRF state token
And the user row is created in auth.users with provider=github and the verified email
And a default workspace is created for the user
And the user is redirected to /home (or the workspace home URL)
And a valid session cookie is set (httpOnly, secure, SameSite=Lax) [NEEDS PO/DEV CONFIRMATION on cookie attributes]
```

### AC-2: Google OAuth — First-Time Sign-Up (Happy Path)
```gherkin
Scenario: Google OAuth first-time sign-up
Given a visitor on the Sign-in screen
And the "Continue with Google" button is enabled and clickable
When they click "Continue with Google" and approve the OAuth consent on Google
Then Supabase Auth completes the code exchange and creates/upserts the user
And a default workspace is created for the user
And the user is redirected to /home (or the workspace home URL)
And a valid session is established
```

### AC-3: Returning OAuth User — Sign-In (Happy Path)
**[NEEDS PO/DEV CONFIRMATION]**
```gherkin
Scenario: Returning GitHub OAuth user signs in
Given a user who previously signed up via GitHub OAuth
When they click "Continue with GitHub" and approve the consent screen
Then Supabase Auth upserts the existing user row (no duplicate created)
And no second workspace is created
And the user is redirected to /home with their existing workspace
And the session cookie is refreshed
```

### AC-4: OAuth Consent Denied
```gherkin
Scenario: OAuth consent denied by user
Given a visitor who clicks "Continue with GitHub" or "Continue with Google"
When they deny the OAuth consent screen on the provider side
Then Bunkai redirects to /login with the error code OAUTH_DENIED in the URL or error state
And surfaces a "Try a different method" CTA including the magic-link fallback option
And no user record or session is created
```

### AC-5: OAuth State CSRF Token Mismatch
```gherkin
Scenario: OAuth callback with mismatched state token
Given an OAuth callback request arrives at /auth/callback
And the state parameter does not match the originally issued CSRF state token
When the server processes the callback
Then the request is rejected with HTTP 403
And the error code OAUTH_STATE_MISMATCH is returned or surfaced
And no session is created
And no user row is created or modified
```

### AC-6: Third-Party Cookie Restrictions
```gherkin
Scenario: OAuth callback blocked by third-party cookie restrictions
Given a visitor on a browser that blocks third-party cookies
When the OAuth callback cannot set the session cookie within 30 seconds
Then Bunkai surfaces the magic-link fallback within 30 seconds
And displays clear explanatory copy describing why the fallback was triggered
And no broken state or orphaned session exists
```

### AC-7: EMAIL_EXISTS — Cross-Provider Email Collision
**[NEEDS PO/DEV CONFIRMATION]**
```gherkin
Scenario: User attempts OAuth with an email already registered via a different provider
Given a user whose email is already associated with a different OAuth provider (e.g., registered via GitHub)
When they attempt to sign in via Google using the same verified email
Then Bunkai rejects the attempt with error code EMAIL_EXISTS
And the user is redirected to /login with the EMAIL_EXISTS error surfaced in the UI
And a message explains that the account exists under a different provider and manual linking requires support
And no duplicate user record is created
```

### AC-8: Workspace Bootstrap Failure
**[NEEDS PO/DEV CONFIRMATION]**
```gherkin
Scenario: OAuth sign-in succeeds but default workspace creation fails
Given a first-time OAuth user whose code exchange completes successfully
When the server-side default workspace creation fails (DB error, RLS violation, timeout)
Then the user does not land on a broken or empty /home
And either a recoverable error screen is shown with a retry option,
Or the user is redirected to an onboarding/workspace-setup screen
And the session is still valid (user is authenticated)
And the failure is logged server-side with sufficient context for debugging
```

### AC-9: OAuth Initiation Failure
**[NEEDS PO/DEV CONFIRMATION]**
```gherkin
Scenario: OAuth provider redirect fails at initiation
Given a visitor who clicks "Continue with GitHub" or "Continue with Google"
When the redirect to the provider fails (network error, provider unavailable, misconfigured client ID)
Then Bunkai surfaces an error message on the login screen
And a retry option or alternative sign-in method (magic-link) is presented
And the user is not left on a blank screen or unhandled error page
```

### AC-10: UI Buttons Enabled and Login Copy Updated
**[NEEDS PO/DEV CONFIRMATION]**
```gherkin
Scenario: OAuth buttons are active and login copy is accurate
Given the Sign-in screen after BK-3 ships
Then the "Continue with GitHub" button is enabled (not disabled, not cursor-not-allowed)
And the "Continue with Google" button is enabled (not disabled, not cursor-not-allowed)
And the login page no longer contains the copy "OAuth and SSO ship next sprint"
```

---

## ATP DRAFT — Test Outlines (Phase 4)

> Names only — no test data tables, no parametrization, no Faker recipes.

### Positive (5)

1. `GitHub OAuth — first-time sign-up creates user and default workspace, redirects to /home`
2. `Google OAuth — first-time sign-up creates user and default workspace, redirects to /home`
3. `GitHub OAuth — returning user signs in, no duplicate user or workspace created`
4. `Google OAuth — returning user signs in, session refreshed, workspace unchanged`
5. `OAuth buttons enabled and login copy updated after BK-3 ships`

### Negative (7)

6. `OAuth consent denied (GitHub) — redirect to /login with OAUTH_DENIED, magic-link CTA visible`
7. `OAuth consent denied (Google) — redirect to /login with OAUTH_DENIED, magic-link CTA visible`
8. `OAuth state CSRF token mismatch — 403 returned, OAUTH_STATE_MISMATCH code, no session created`
9. `EMAIL_EXISTS — Google OAuth attempt with GitHub-registered email rejected, error surfaced in UI`
10. `EMAIL_EXISTS — GitHub OAuth attempt with Google-registered email rejected, error surfaced in UI`
11. `OAuth initiation failure (provider unavailable) — error message shown, magic-link fallback available`
12. `Workspace bootstrap failure after successful code exchange — no broken /home, recoverable error shown`

### Boundary (3)

13. `Third-party cookie restrictions — magic-link fallback surfaces within exactly 30s`
14. `Simultaneous OAuth and magic-link session — no session collision or race condition`
15. `OAuth callback with expired code (code reuse after TTL) — rejected, no session created`

### Integration (5)

16. `GitHub OAuth full flow — Supabase Auth integration: code exchange, user upsert, session cookie set`
17. `Google OAuth full flow — Supabase Auth integration: code exchange, user upsert, session cookie set`
18. `First OAuth login triggers workspace row creation in workspaces table and workspace_members row`
19. `OAuth session cookie properties — httpOnly, secure, SameSite=Lax verified at network layer`
20. `Repeated failed CSRF state probes — rate-limiting or lockout behavior at /auth/callback`

**Coverage estimate**: 5 positive / 7 negative / 3 boundary / 5 integration = **20 outlines total**

---

## Edge Cases

| Edge Case | Criticality | Why |
|---|---|---|
| User closes browser mid-OAuth flow (before callback arrives) | HIGH | Dangling state token; must expire gracefully without leaking a partial session |
| OAuth callback arrives after state token TTL expires | HIGH | Server must reject with error, not create a session on stale state |
| Provider returns unverified email (GitHub allows unverified email addresses) | HIGH | Unverified email used to create account could bypass email-ownership contract; Supabase may or may not enforce this |
| Concurrent OAuth flows from same browser (two tabs) | MEDIUM | State token collision or overwrite; second callback may validate against wrong state |
| User with `+` alias email via Google (e.g. user+alias@gmail.com) vs. GitHub registered email | MEDIUM | Email normalization; alias may be treated as distinct identity, causing false EMAIL_EXISTS or false duplicate |
| Network timeout between Supabase code exchange and workspace creation | MEDIUM | Atomicity gap — auth succeeds but workspace is never created; user is authenticated but has no workspace |
| OAuth flow initiated on mobile WebView (e.g. LinkedIn or Slack in-app browser) | LOW | Third-party cookie restrictions are near-universal in WebViews; 30s fallback timing may behave differently |
| User disables JavaScript after OAuth redirect but before callback completes | LOW | Edge case but worth noting for completeness; callback is server-side so JS state is not required |

---

## Open Questions for PO / Dev (BLOCK sprint planning)

> Only genuine blockers — 5 questions that must be answered before Dev can start or QA can sign off on ACs.

**Q1 — Redirect target after successful OAuth** *(BLOCKER — Contradiction C1)*
The AC workflow says redirect to `/home` but the existing callback route redirects to `/projects`. Which path is canonical? If `/home` does not yet exist as a route, what is the interim redirect target? Dev must align the implementation with the agreed path before writing the callback handler.

**Q2 — Observable evidence of workspace creation** *(BLOCKER — Ambiguity A5)*
What is the testable signal that confirms the default workspace was created? Is the user redirected to a workspace-scoped URL (e.g. `/workspaces/{slug}/home`)? Is the workspace name visible in the UI header immediately after login? Or is workspace existence verifiable only via Supabase DB query? Without an observable signal, ATP outlines 1, 2, 3, 4, and 18 cannot be executed.

**Q3 — EMAIL_EXISTS user-facing behavior** *(BLOCKER — Ambiguity A4 / Gap G2)*
Business rule #3 states that a second provider with the same email is rejected with `EMAIL_EXISTS`, but no AC defines what the user sees. Is the error surfaced as: (a) a redirect to `/login?error=EMAIL_EXISTS`, (b) an in-page toast, (c) an error page, or (d) something else? Dev needs this to implement the error path; QA needs it to write assertions for outlines 9 and 10.

**Q4 — OAuth callback route strategy** *(BLOCKER — Implementation Gap G8)*
Should the existing `app/auth/callback/route.ts` be extended to handle both magic-link and OAuth callbacks (branching on presence of `state` param), or should a dedicated `app/auth/oauth/callback/route.ts` be created? This affects the Supabase redirect URI configuration and must be decided before Dev implements the server-side handler.

**Q5 — Workspace bootstrap failure behavior** *(BLOCKER — Gap G3)*
If the default workspace creation fails after a successful OAuth code exchange, what should happen? Options: (a) rollback the session and redirect to `/login?error=WORKSPACE_CREATION_FAILED`; (b) allow the session to persist and redirect to an onboarding/setup screen where the user can retry workspace creation; (c) create the workspace lazily on first `/home` load. This decision affects both the error AC (AC-8) and the integration test for workspace bootstrapping (outline 18).
