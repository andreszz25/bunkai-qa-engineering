# Sign up and sign in via OAuth (GitHub / Google)

**Jira Key:** [BK-3](https://upexgalaxy67.atlassian.net/browse/BK-3)
**Epic:** [BK-1](https://upexgalaxy67.atlassian.net/browse/BK-1) (Tenancy & Identity)
**Priority:** Medium
**Story Points:** 8
**Status:** Ready For Dev

---

## User Story

***Source spec:*** FR-001 — Email + OAuth sign-up (OAuth portion)

## User story

As a visitor, I want to sign up and sign in via OAuth (GitHub or Google) so that I can join Bunkai using my existing identity provider.

Implements ***FR-001**** partially — OAuth side only. Email magic-link is covered by ****BK-2***.

## Business rules

- OAuth state token MUST be validated server-side; mismatch → 403.
- An OAuth-only user has NO password and cannot use email magic-link as alternate sign-in unless explicitly linked (Phase 2).
- If a user signs up with both GitHub and Google using the same verified email, the second attempt is rejected with `EMAIL_EXISTS` (manual linking by support in MVP).

## Workflow

1. Visitor clicks "Continue with GitHub" (or Google).
2. Browser is redirected to provider's consent screen with state token attached.
3. User approves on provider.
4. Provider redirects to `/auth/callback?code=...&state=...`.
5. Server validates state, exchanges code with Supabase Auth.
6. On success: user row created or upserted with `provider` field; if first verified login, default workspace created; session cookie set.
7. Redirect to `/home`.
8. On any failure: redirect to `/login` with error code + magic-link fallback CTA.

## Definition of done

- Implementation complete
- Unit tests written
- Code reviewed
- Documentation updated

## Labels

`auth`, `mvp`, `wave-1`

## QA Refinements (Shift-Left Analysis)

***Refined on****: 2026-05-26 | ****QA mode***: Shift-Left pre-sprint batch  
***Verdict***: Needs Improvement — 7 AC gaps, 5 ambiguities, 2 contradictions found

---

### Story Quality Summary

| Axis | Rating |
|---|---|
| Business logic | High |
| Integration complexity | High |
| Data validation | Medium |
| UI complexity | Low |

***Test effort estimate***: High — 20 test outlines (5 positive, 7 negative, 3 boundary, 5 integration)

---

### Critical Implementation Gap

***OAuth buttons in ****`login/page.tsx`**** are hardcoded as ***`disabled` (label "soon", `cursor-not-allowed`, `opacity-60`). BK-3 cannot be tested until these buttons are enabled as part of this story's implementation scope.

---

### Ambiguities Found (5)

| # | Question | Impact |
|---|---|---|
| A1 | Who validates OAuth state token — Supabase SDK or custom middleware? | Scope of state-tampering test |
| A2 | Is `provider` upserted to `auth.users.raw*app*meta_data` or a separate Bunkai table? | Determines DB assertions |
| A3 | Is first-login workspace bootstrap synchronous (rollback on fail) or fire-and-forget? | Two different test paths |
| A4 | Canonical post-OAuth redirect: `/home` (story) vs `/projects` (code)? | Success-path assertion target |
| A5 | Is magic-link fallback CTA always visible or dynamically rendered on error? | CTA visibility assertion |

---

### AC Gaps Found (7)

| # | Missing AC | Risk if omitted |
|---|---|---|
| G1 | State token mismatch → 403 + redirect to `/login?error=state_mismatch` | CSRF/session fixation — pre-release checklist item #1 |
| G2 | Provider returns error param (user denies consent) → graceful error redirect | Callback crashes with 500 |
| G3 | Workspace bootstrap fails after token exchange → session NOT set | Ghost user: valid JWT, no workspace, all API calls 403 |
| G4 | Returning user (not first login) → no duplicate workspace created | Workspace duplication on every sign-in |
| G5 | OAuth redirect URI must be documented in spec or `.env.example` | Misconfigured OAuth app = all sign-ins fail silently |
| G6 | `EMAIL_EXISTS`: HTTP status, user-visible message, error URL not specified | Silent failure or account-existence information leak |
| G7 | Rate-limit policy for OAuth initiation not specified | Credential-stuffing via OAuth provider |

---

### Contradictions Found (2)

| # | Contradiction |
|---|---|
| C1 | Story workflow says redirect to `/home`; callback route code defaults to `/projects`. Must reconcile before Dev implements. |
| C2 | `login/page.tsx` comment says "OAuth ships next sprint" — if BK-3 is the OAuth ticket, UI copy AND button enable are in-scope. |

---

### Critical Questions for PO (BLOCK sprint planning)

1. ***Canonical post-OAuth redirect***: `/home` or `/projects`? (C1)
2. `EMAIL_EXISTS`*** exact error code and user-visible message?*** (G6)
3. ***Invited users exempt from default workspace bootstrap?*** (E8 — prevents dual-workspace creation)

---

### Refined ACs (7 new scenarios added)

See comment "Shift-Left Refinement Mirror" on this issue for the full refined AC set, edge case analysis, and test outlines.

---

**Shift-Left label: **`shift-left-reviewed`** **`shift-left-2026-05-26`

---

## Acceptance Criteria

```

Scenario: GitHub OAuth happy path
Given a visitor on the Sign-in screen
When they click "Continue with GitHub" and approve the OAuth consent
Then Supabase Auth completes the code exchange with a valid CSRF state token
And the user row is upserted in auth.users with provider=github
And the user lands on the Workspace Home with status 201
And a default workspace exists

Scenario: Google OAuth happy path
Given a visitor on the Sign-in screen
When they click "Continue with Google" and approve the OAuth consent
Then Supabase Auth completes the code exchange and signs in / signs up the user
And the user lands on the Workspace Home

Scenario: OAuth consent denied
Given a visitor who clicks "Continue with GitHub"
When they deny the consent screen on the provider side
Then Bunkai redirects to /login with error code OAUTH_DENIED
And surfaces a "Try a different method" CTA including the magic-link fallback

Scenario: OAuth state CSRF token mismatch
Given an OAuth callback whose state token does not match the issued one
When the callback hits /auth/callback
Then the request is rejected with code OAUTH*STATE*MISMATCH and 403
And no session is created

Scenario: OAuth callback blocked by third-party-cookie restrictions
Given a visitor on a browser blocking third-party cookies
When the OAuth callback popup fails to set a cookie within 30s
Then Bunkai surfaces the magic-link fallback within 30s
And shows a clear copy explaining the fallback

```

---

### Designed by Ely.

---

## Business Rules

- OAuth state token MUST be validated server-side; mismatch → 403 reject.

- An OAuth-only user has NO password and cannot use email magic-link as alternate sign-in unless explicitly linked (Phase 2).

- If a user signs up with both GitHub and Google using the same verified email, the second attempt is rejected with EMAIL_EXISTS (manual linking by support in MVP).

---

## Scope

- OAuth provider: GitHub
- OAuth provider: Google
- CSRF state-token validation
- Auto-create personal default workspace on first verified OAuth sign-in
- Magic-link fallback surfaced when OAuth callback fails within 30s

---

## Workflow

1. Visitor clicks "Continue with GitHub" (or Google).

2. Browser is redirected to provider's consent screen with state token attached.

3. User approves on provider.

4. Provider redirects to /auth/callback?code=...&state=...

5. Server validates state, exchanges code with Supabase Auth.

6. On success: user row created/upserted with provider field; if first verified login, default workspace created; session cookie set.

7. Redirect to /home.

8. On any failure: redirect to /login with error code + magic-link fallback CTA.

---

## Definition of Done

- [ ] Implementation complete
- [ ] Unit tests written
- [ ] Code reviewed
- [ ] Documentation updated

---

## Metadata

- **Created:** 5/19/2026
- **Updated:** 5/27/2026
- **Reporter:** Ely
- **Assignee:** Andrés Daniel Cumare Morales
- **Labels:** auth, mvp, shift-left-2026-05-26, shift-left-reviewed, wave-1

---

_Synced from Jira by sync-jira-issues_
_Last sync: 2026-05-28T08:58:33.896Z_
