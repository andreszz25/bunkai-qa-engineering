# Sign up and sign in with email (magic-link)

**Jira Key:** [BK-2](https://upexgalaxy67.atlassian.net/browse/BK-2)
**Epic:** [BK-1](https://upexgalaxy67.atlassian.net/browse/BK-1) (Tenancy & Identity)
**Priority:** Medium
**Story Points:** 8
**Status:** Ready For Dev

---

## User Story

***Source spec:*** FR-001 — Email + OAuth sign-up (email magic-link portion)

## User story

As a visitor, I want to sign up and sign in with email using a magic-link flow so that I can access Bunkai without managing a password.

Implements ***FR-001**** partially — email side only. OAuth side is covered by ****BK-3***.

## Business rules

- Email must be unique in `auth.users` (Supabase enforces).
- First verified sign-in MUST create exactly one default workspace; idempotent on retry.
- Magic-link tokens are signed JWTs (Supabase-managed), single-use, TTL 15 minutes.
- A user who accepted a workspace invite skips the personal-workspace auto-create.

## Workflow

1. Visitor lands on `/login`.
2. Enters email, clicks "Send magic link".
3. Supabase Auth dispatches signed email.
4. Visitor opens email client, clicks link.
5. Browser hits `/auth/callback?token=...`; server validates token via Supabase.
6. On success: user row created or upserted; if first verified login and no pending invite, default workspace created; session cookie set.
7. Redirect to `/home` (Workspace Home).

## Definition of done

- Implementation complete
- Unit tests written
- Code reviewed
- Documentation updated

## Labels

`auth`, `mvp`, `wave-1`

---

## QA Refinements (Shift-Left Analysis)

> Added 2026-05-25 by Shift-Left QA. Full ATP DRAFT lives in custom field 🧪 Acceptance Test Plan (ATP) and mirrored as a comment on this issue. This section captures the slices PO + Dev need before estimation.

### Refined Acceptance Criteria — summary

11 Gherkin scenarios produced (Happy 2 / Negative 5 / Boundary 2 / Integration 2). Key contract decisions:

- Redirect chain: callback → `/onboarding` (uses existing guard that short-circuits to `/projects` when membership exists). The story's `/home` is replaced by this chain because `/home` route does not exist in the codebase.
- Default workspace creation: KEEP the manual `/onboarding` form path (rejecting AC's "auto-create on first sign-in" because slug must be globally unique + user-controlled). Pre-fill workspace name + slug suggestions in the form.
- Error code envelope: extend existing ApiError envelope with `INVALID*EMAIL`, `TOKEN*USED`, `TOKEN*EXPIRED`, `MISSING*CODE`, `RATE*LIMITED`, `UPSTREAM*ERROR`. Callback maps Supabase v2 error codes to these and passes via `?error=...` so `/login` renders contextual UX.
- RFC 5321: enforce 254-char ceiling client + server (`z.string().email().max(254)`).
- TTL 15 min: ops concern — verify `auth.otp_exp = 900` on each Supabase project; document in repo.

Full Gherkin in the comment + ATP field.

### Edge Cases Identified

15 edge cases catalogued (5 High, 7 Medium, 3 Low). High-severity highlights:

- Same email requesting links from two devices/browsers concurrently (resend semantics undefined)
- Magic link clicked on a different device than the one that requested it
- Magic link clicked while user is already signed in as a **different** identity
- Mailbox bounces / undeliverable address handling
- Slug collision on bootstrap (two users want same slug)
- Bootstrap RPC fails mid-flight (partial-state risk; mitigated by SECURITY DEFINER atomicity)
- First-sign-in race (double-click callback parallel)
- Supabase project paused / unreachable

### Clarified Business Rules

- Magic-link tokens single-use; replay → `TOKEN_USED` (NOT silent success).
- Magic-link TTL = 15 minutes (Supabase `auth.otp_exp = 900`) — enforced by GoTrue config, NOT codebase. Must be verified per environment before development starts.
- First-sign-in default workspace = manual onboarding form (with pre-fill UX), NOT automatic background creation.
- Open-redirect guard on `next` parameter retained (callback already validates root-relative path).
- Pending-invite bypass branch belongs to BK-5, NOT BK-2. The onboarding-guard `eq('status', 'active')` already supports the future composition.
- Resend-before-expiry: MVP keeps both tokens valid (Supabase default) + 60s UI cooldown to prevent accidental double-request. Security upgrade (invalidate-on-resend) deferred to a separate Story unless PO greenlights now.

### Open Questions for PO / Dev / Design

For PO (5):

1. Confirm resend semantics: MVP both-valid + 60s cooldown? Or invalidate-on-resend now (+1-2 sprint days)?
2. Workspace-name default pre-fill: acceptable? Or prefer empty field?
3. UX scope cut: confirm IN BK-2 = 5.1 (cooldown) / 5.3 (error pages) / 5.5 (pre-fill) / 5.7 (a11y); deferred = 5.2 (provider deep-links) / 5.4 (email memory) / 5.6 (welcome toast) / 5.9 (branded email)?
4. Confirm `/onboarding → /projects` chain replaces story's `/home`?
5. Magic-link branded email template — separate ops Story?

For Dev (4):

1. Exact Supabase v2 error codes for token-already-used vs token-expired (deterministic mapping needed before tests)?
2. Where does `auth.otp_exp = 900` ops checklist live in repo (`supabase/config.toml`? `docs/ops-runbook.md`?)?
3. Bootstrap RPC race on double-click: rely on `23505` UNIQUE-slug catch, or debounce client-side?
4. `workspace_members.status` enum: what statuses exist beyond `active`? Affects BK-5 composition.

For Design (2):

1. Mockups for contextual error banners on `/login` (`TOKEN*EXPIRED` / `TOKEN*USED` variants).
2. Resend-cooldown UX spec (inline countdown? disabled button + timer? toast?).

### Scope refinement — IN vs OUT of BK-2

***IN BK-2:***

- Magic-link send + callback (already shipped)
- Callback redirect refactor → `/onboarding` (NEW)
- Onboarding pre-fill of name + slug (NEW)
- Specific error codes mapping in API + callback (NEW)
- RFC 5321 254-char enforcement client + server (NEW)
- UX 5.1, 5.3, 5.5, 5.7 from refinement document
- Ops verification of `auth.otp_exp = 900`

***OUT (delegated to other Stories):***

- OAuth → BK-3
- Invite acceptance + bypass branch → BK-5
- Workspace switching → BK-6
- UX 5.2, 5.4, 5.6, 5.9, branded email template → "Auth UX Polish" follow-up Story
- Token-invalidation-on-resend → separate security Story (if PO greenlights)

---

**See custom field 🧪 Acceptance Test Plan (ATP) + Shift-Left comment for the complete refinement (****~****17 test outlines, full Gherkin scenarios, AC↔code reconciliation per divergence).**

---

## Acceptance Criteria

## Refined Acceptance Criteria (Shift-Left QA pass — 2026-05-25)

> Refined and consolidated by QA during the pre-sprint Shift-Left review. The original PO-authored Gherkin lives in the repo at `.context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-2-sign-up-and-sign-in-with-email-magic-link/story.md`. Reconciliation reasoning (AC ↔ code divergences, decisions, edge cases, UX proposals, scope cuts) is captured in the ***🧪 Acceptance Test Plan (ATP)**** field and the ****Shift-Left Refinement*** comment on this issue.

```gherkin
Background:
  Given the Supabase auth.otp_exp is set to 900 seconds (15 minutes)
    And the project SMTP / mailer is operational
    And the user is not currently signed in

# ---- Happy path ----

Scenario: Successful first-time email magic-link sign-up
  Given a visitor on /login
  When they enter "qa-new@bunkai.test" (a valid RFC 5321 email, <=254 chars)
    And click "Send magic link"
  Then the API responds 200 with `{ ok: true }`
    And the form shows the "Check your inbox" confirmation state
    And within 30s an email with subject "Sign in to Bunkai" arrives in that inbox
  When they click the magic link in the email
  Then the browser is redirected through `/auth/callback?code=...`
    And exchanged into a Supabase session (cookie set)
    And then routed to `/onboarding` (because the user has no workspace yet)
    And `/onboarding`'s server guard renders the workspace-create form
    And the workspace-name input is pre-filled with "qa-new's workspace"
    And the slug input is pre-filled with "qa-news-workspace" (slugified suggestion)
  When they accept the defaults and click "Create workspace"
  Then the RPC `bunkai*bootstrap*workspace` returns a workspace_id atomically
    And a row exists in `workspaces` with owner*user*id = the new user's id
    And a row exists in `workspace_members` (role=owner, status=active)
    And the user is redirected to `/projects`

Scenario: Successful returning-user sign-in (workspace exists)
  Given a user who already has at least one active workspace_member row
  When they request a magic link with their existing email
    And click the link
  Then `/auth/callback` exchanges the code into a session
    And redirects to `/onboarding`
    And `/onboarding`'s guard short-circuits to `/projects` (membership exists)
    And the user lands on `/projects` directly

# ---- Negative path ----

Scenario: Invalid email format rejected client-side
  Given a visitor on /login
  When they type "notanemail" into the email field
  Then the "Send magic link" button stays disabled
    And no POST is dispatched

Scenario: Invalid email format rejected server-side
  Given a visitor on /login
  When the client is bypassed and a body `{ email: "no-at-symbol" }` is POSTed to /api/v1/auth/magic-link
  Then the API responds 400 with envelope `{ ok: false, error: { code: "INVALID_EMAIL", message: ... } }`

Scenario: Email exceeds RFC 5321 length limit
  Given a visitor on /login
  When they enter an email whose total length is 255 characters
  Then the form rejects it client-side with "Email exceeds 254-character limit"
    And no POST is dispatched
  And the server-side Zod schema also rejects with code "INVALID_EMAIL" if bypassed

Scenario: Magic-link token replay blocked
  Given a user who has successfully signed in via a magic link
  When they click the same link a second time (or the same `?code=` is sent to /auth/callback)
  Then Supabase exchangeCodeForSession returns a "token already used" error
    And the callback redirects to /login?error=TOKEN_USED
    And the /login page renders "This link was already used — request a new one"

Scenario: Magic-link token expired
  Given a magic link generated more than 15 minutes ago
  When the visitor clicks it
  Then Supabase exchangeCodeForSession returns an OTP-expired error
    And the callback redirects to /login?error=TOKEN_EXPIRED
    And the /login page renders "Your link expired — request a new one" with the email field pre-filled

Scenario: Callback missing the `code` query parameter
  Given a request to /auth/callback with no `?code=`
  Then the route redirects to /login?error=MISSING_CODE

Scenario: Rate-limited resend (Supabase 429)
  Given a visitor who has requested a magic link 5 times in 60 seconds
  When they submit a 6th request
  Then the API responds 429 with envelope `{ code: "RATE_LIMITED", ... }`
    And the form shows a "Too many requests — try again in N seconds" toast

# ---- Boundary / edge ----

Scenario: Resend allowed after 60-second UI cooldown
  Given a visitor who has just sent a magic link
  When they look at the "Check your inbox" screen
  Then a "Resend link" button appears, initially disabled with countdown
  When 60 seconds pass
  Then the "Resend link" button becomes enabled
  When they click it
  Then a second magic link is dispatched to the same email
    And the prior link remains valid until its own 15-min TTL elapses
       (Note: per §2.6 — MVP keeps both valid; future Story may invalidate prior)

Scenario: Open-redirect attempt via `next` parameter blocked
  Given a magic link generated with `next=https://evil.example.com/steal`
  When the callback runs
  Then the unsafe `next` is rejected and replaced with the default `/onboarding` (or `/projects` if user has workspace)
    And the user does not leave the bunkai domain

Scenario: Session cookie set with secure attributes
  Given a successful callback exchange in production env
  Then the session cookie has `Secure`, `HttpOnly`, `SameSite=Lax`, and the Supabase-managed name
    And `getUser()` on the next protected route returns the new user
```

***Markers used:*** all NEEDS PO/DEV CONFIRMATION items are explicitly captured in §8 PO/Dev questions below; the AC text itself is final pending those answers.

---

---

**Copied from Refined AC by QA — Shift-Left pass 2026-05-25. PO ownership of this field returns after Estimation grooming; any further AC edits must go through PO.**

---

## Business Rules

- Email must be unique in auth.users (Supabase enforces).

- First verified sign-in MUST create exactly one default workspace; idempotent on retry.

- Magic-link tokens are signed JWTs (Supabase managed), single-use, TTL 15 minutes.

- A user who accepted a workspace invite skips the personal-workspace auto-create.

---

## Scope

- Email magic-link sign-up (new account creation)
- Email magic-link sign-in (returning user)
- Auto-create personal default workspace on first verified sign-in
- Email validation per RFC 5321 (max 254 chars)
- Magic-link TTL 15 minutes, single-use

---

## Mockup

| ***A**** | ****B**** | ****C*** |
| --- | --- | --- |
| X | Y | Z |
|  |  |  |

---

## Workflow

1. Visitor lands on /login.

2. Enters email, clicks "Send magic link".

3. Supabase Auth dispatches signed email.

4. Visitor opens email client, clicks link.

5. Browser hits /auth/callback?token=...; server validates token via Supabase.

6. On success: user row created/upserted; if first verified login and no pending invite, default workspace created; session cookie set.

7. Redirect to /home (Workspace Home).

---

## References

- [External Link](https://upexbunkai.vercel.app)

---

## Definition of Done

- [ ] Implementation complete
- [ ] Unit tests written
- [ ] Code reviewed
- [ ] Documentation updated

---

## Metadata

- **Created:** 5/19/2026
- **Updated:** 5/25/2026
- **Reporter:** Ely
- **Assignee:** Unassigned
- **Labels:** auth, mvp, shift-left-2026-05-25, shift-left-reviewed, wave-1

---

_Synced from Jira by sync-jira-issues_
_Last sync: 2026-05-26T08:48:55.380Z_
