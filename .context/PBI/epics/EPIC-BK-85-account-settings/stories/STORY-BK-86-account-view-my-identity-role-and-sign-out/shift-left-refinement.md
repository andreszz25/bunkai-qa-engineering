# BK-86 — Shift-Left Refinement (Acceptance Criteria Analysis)

> **REDO — corrects a prior pass.** The previous refinement of this story wrongly concluded BK-86 had **zero acceptance criteria** and proceeded to author 10 ACs from scratch. That conclusion was an artifact of a stale field-ID cache bug: `.agents/jira-fields.json` pointed the "Acceptance Criteria (Gherkin)" mapping at a non-existent `customfield_10141`, so `bun run jira:sync-issues` synced an empty AC file. The cache has been corrected — the real field is `customfield_10063` ("✅ Acceptance Criteria (Gherkin)") — and it contains **3 live Gherkin scenarios** that are materially more concrete than the bare user-story line suggested (they already name "global chrome", "account affordance", "name or initials", and a dedicated keyboard-accessibility scenario). This refinement **builds on those 3 real scenarios as baseline** — tightening their language where genuinely ambiguous and adding new scenarios only for gaps they leave open — rather than replacing them. The discarded v1's from-scratch AC-1..AC-10 set must NOT ship; its codebase feasibility table is reused below (re-validated against the new "global chrome" lens, which changes the central feasibility question).

---

## Critical Analysis

**Persona & business context** (unchanged from v1, still accurate): Elena Vargas (Senior QA Engineer) needs passive identity/role confirmation ("am I in the right account/workspace") plus an active session-termination action, framed around a shared-machine security concern. This sits at the intersection of the Auth flow (`business-data-map.md` Flow 1) and the Workspace/RBAC model (`workspace_members.role`).

**The central feasibility question has changed.** v1 asked "does the plumbing for identity/role/sign-out exist?" The real ACs ask a sharper question: **does a persistent "global chrome" with an "account affordance" exist anywhere in the app — even partially?** The answer reframes the whole story from "wire up a few missing pieces" to "build the app's first persistent account-menu surface, then wire identity/role/sign-out into it."

**Re-validated codebase feasibility** (light exploration of `../upex-bunkai-tms`, focused on the global-chrome/account-affordance requirement):

| Surface | Found? | Detail |
|---|---|---|
| **Persistent global chrome / account affordance** (the component the real ACs presuppose) | **DOES NOT EXIST — confirmed, even partially** | `app/(app)/layout.tsx` — the ONE layout wrapper shared by every authenticated route — renders only `<AuthProvider>` + a bare flex column. No header, no nav rail, no account control. `Topbar` (`components/layout/Topbar.tsx`) is a page-local primitive instantiated separately inside `app/(app)/projects/page.tsx`, `[projectSlug]/page.tsx`, and `project-explorer.tsx` — and even there it renders only a `WorkspaceSwitcher` + breadcrumb, never anything resembling "the user's own identity". `/onboarding` and `/workspaces/[id]` render with **no Topbar at all**. There is no single place in the codebase today from which Scenario 1's "global chrome" / "account affordance" could be said to exist, even in embryonic form. |
| Closest existing analog — `WorkspaceSwitcher` | PARTIAL, wrong shape | `components/layout/WorkspaceSwitcher.tsx` is a per-page dropdown (`useState` open/close, click-toggle button) that shows the *workspace/project* name — never the signed-in *user's* identity or role. It has no `Escape`-to-close handler and no focus-return logic, so it cannot double as a model for Scenario 3's keyboard-accessibility requirements. |
| Closest existing analog — `CommandPalette` | PARTIAL, wrong purpose | `components/layout/CommandPalette.tsx` is the only component in the repo that handles `Escape` (`if (e.key === 'Escape') { setOpen(false); }`) — a useful implementation reference for Scenario 3, but it's a command launcher, not an account menu, and shares none of the "name or initials → email + role" content model. |
| Sign-out function | YES, but **unwired** | `components/providers/auth-context.tsx` exposes `AuthProvider.signOut()` (`supabase.auth.signOut()`); zero call sites outside the provider — no button/menu/link triggers it anywhere. |
| Identity resolution (`/api/v1/me`) | PARTIAL | `app/api/v1/me/route.ts` already resolves and returns `user: { id, email }`, `workspaces[]`, and `active_workspace_id`. No UI consumes `user.email` for display. |
| Role resolution at API layer | **MISSING** | `/api/v1/me` returns workspace objects `{ id, slug, name, plan, owner_user_id, created_at }` with **no per-membership `role` field** — the data lives in `workspace_members.role` but is not surfaced through this endpoint, which is the only "who am I" endpoint the app has. |
| Display name / initials / avatar | **NOT MODELED** | No `display_name`, `full_name`, or `avatar_url` column in any of the 8 migrations. `auth.users` (Supabase-managed) exposes only `email` through the app's own `/me`. This directly collides with Scenario 1's "name **or initials**" framing — see Ambiguity SQ-1 below. |

**Feasibility verdict — sharper than v1's**: this is **not** "a thin UI-only story with some missing plumbing." The real ACs presuppose a component class — a persistent, keyboard-accessible, dismissible account-affordance menu living in global chrome — that has **zero precedent** anywhere in this codebase (the closest analogs, `WorkspaceSwitcher` and `CommandPalette`, each cover one slice of the requirement and neither is global). Building it requires: (a) introducing the app's first persistent shell element in `app/(app)/layout.tsx` (an architectural first for this app), (b) an API contract change (`role` field on `/me`, and a resolution for "name or initials" given the schema has neither), (c) a fully new keyboard-interaction component (focus management, `Escape`, focus-return — none of which any existing menu does completely). **This tension — real ACs assuming infrastructure that does not exist — is the single most important thing for PO/Dev to know before estimation**, because it changes this from a "few-day UI task" to a "design + build a new global-chrome primitive" task.

---

## Story Quality Analysis

> Anchored on the 3 REAL scenarios — not on the bare user-story line. Each item below cites the specific scenario language it scrutinizes.

### Ambiguities in the existing scenarios

| # | Scenario / phrase | Question for PO/Dev | Impact on testing | Suggested clarification |
|---|---|---|---|---|
| SQ-1 | Scenario 1: "**name or initials**" | The schema has neither `display_name` nor any name-derived field — `auth.users` exposes only `email` through `/api/v1/me`. "Name or initials" presupposes a name source that does not exist. Is a `display_name` field being added in this story, or does "name" here mean "derive a name/initials from the email local-part" (e.g. `elena@bunkai.io` → "E" or "EL")? | Determines whether the affordance label is a schema/API change (name field) or a pure-presentation derivation (initials-from-email). Materially different effort and a materially different test-data shape. | Confirm the exact source for the affordance label: (a) new `display_name` column + UI, (b) initials derived from email local-part, or (c) Supabase Auth `user_metadata.full_name` if populated via OAuth (not currently used — magic-link only). Whichever is chosen, the scenario's "or" should collapse to a single deterministic rule QA can assert against. |
| SQ-2 | Scenario 1: "**global chrome**" | The term names a UI region that, per the Critical Analysis above, does not exist anywhere in the codebase today — not even as a per-page pattern that could be "promoted" to global. Is "global chrome" a new persistent header/shell to be added to `app/(app)/layout.tsx` (covering `/projects`, `/onboarding`, `/workspaces/[id]`, and all project-explorer routes), or is it scoped to a subset of "main app" pages with onboarding/admin pages explicitly excluded? | This is the single biggest scope driver for the whole story — it decides whether QA needs to traverse 3-4 distinct route families or just one. Untestable as "global" until the page list is named. | Name the concrete page list "global chrome" must appear on — ideally as a Definition-of-Done checklist (mirrors v1's Ambiguity A3, but now anchored to a term the AC itself uses, which makes it answerable with a yes/no per page rather than an open scope debate). |
| SQ-3 | Scenario 1: "**her email and her role in the active workspace** (for example 'elena@bunkai.io — Admin')" | The example pairs email with a *capitalized, human-readable* role label ("Admin"), but the canonical enum in `workspace_members.role` / `domain-glossary.md` is lowercase (`viewer \| member \| admin \| owner`). Is the display label a presentation-layer transform of the enum (`admin` → "Admin"), or a separate copy-deck the design owns (e.g. "Workspace Admin", "Team Owner")? | Determines whether the AC can be asserted against the enum value with a casing transform, or needs a confirmed label-mapping table per role — four values to pin down, not one. | Confirm the four display labels for `viewer / member / admin / owner` (or confirm "capitalize the enum value" is the whole rule). |
| SQ-4 | Scenario 2: "**her session ends**" | "Session ends" is asserted only from the client's perspective (lands on sign-in, back-nav doesn't restore). It does not say whether the underlying Supabase session/cookie is invalidated **server-side** — a distinction that matters enormously for the "shared machine" framing in the parent user story (a client-side-only sign-out leaves a live, replayable session token behind). | Decides whether "session ends" is testable purely via UI navigation assertions, or requires a server-side check (e.g. re-using the old session cookie against a protected API route after sign-out should 401). | Confirm "session ends" includes server-side invalidation (the `middleware.ts` `supabase.auth.getUser()` check on the next request must fail), not just a client redirect — this is the difference between "looks signed out" and "is signed out" on a shared machine. |
| SQ-5 | Scenario 3: "**opens the menu with the keyboard and presses Escape**" | The scenario tests exactly two keyboard interactions (open, then `Escape`-to-close-with-focus-return). It does not cover: Tab-order/focus-trap while the menu is open (can focus escape to background content?), Arrow-key navigation between menu items (a near-universal a11y expectation for menus, per ARIA APG `menu`/`menubutton` patterns), or the accessible name/role exposed to assistive tech (`aria-haspopup`, `aria-expanded`, `role="menu"` — none of which any existing component in this codebase implements correctly; `WorkspaceSwitcher` has no ARIA wiring at all). | Decides how deep the a11y test surface goes: a 2-step smoke check (as literally written) vs. a fuller WCAG-aligned suite (focus trap, roving tabindex, ARIA attributes, screen-reader label). | Confirm whether Scenario 3 is the FULL a11y bar for this story (Escape + focus-return only), or a representative example with the fuller ARIA `menu` pattern implied — this single answer changes the a11y outline count from ~2 to ~6. |

### What the 3 scenarios cover well vs. leave uncovered (relative to full story scope)

The user story promises three things: **(1)** see who I am, **(2)** see my role, **(3)** sign out from anywhere, safely. Mapping the 3 scenarios against that scope:

```
Story scope          | Scenario coverage
---------------------+------------------------------------------------------
(1) See identity     | Scenario 1 — covers DISPLAY (name/initials, email).  Solid.
(2) See my role      | Scenario 1 — covers DISPLAY of role for the ACTIVE workspace
                     |   only, as a single static example ("Admin"). Says nothing
                     |   about: what happens on workspace switch (does the role
                     |   shown update?), what a viewer/member/owner sees (only
                     |   "Admin" is exemplified), or the no-active-workspace state.
                     |   => UNDER-SPECIFIED relative to "my role" framed generally.
(3) Sign out         | Scenario 2 — covers the HAPPY PATH effect (session ends,
                     |   redirect, no back-nav restore) well and concretely.
                     |   Says nothing about: sign-out FAILURE (network/API error),
                     |   multi-tab/multi-device propagation (the "shared machine"
                     |   framing implies this is exactly the risk Elena cares
                     |   about), or a confirm-before-destructive-action pattern.
(a11y, cross-cutting)| Scenario 3 — covers the BASELINE keyboard interaction
                     |   (open + Escape + focus-return). Does not cover focus-trap,
                     |   arrow-key nav, or screen-reader semantics (see SQ-5).
"Anywhere in the app"| Scenario 1 says "from any screen" / "global chrome" — but
                     |   no scenario enumerates which screens, and (per Critical
                     |   Analysis) no global chrome exists to anchor the claim to.
```

**Net read**: the 3 scenarios are strong on the *display* and *baseline sign-out effect* axes, and meaningfully advance the story past "zero ACs" — but they leave **role-display depth** (workspace-switch behavior, per-role labels, no-workspace state), **sign-out failure handling**, and **multi-surface session termination** as real gaps the full user-story scope implies but the 3 scenarios don't test. These gaps drive the "New Scenarios" additions below.

### Testability validation

**Verdict: Yes, with refinement** — a meaningful upgrade from v1's "No (zero ACs)" verdict, now that the real field has surfaced 3 concrete, mostly-testable scenarios. Two of the three (Scenarios 2 and 3) are testable close to as-written; Scenario 1 needs the SQ-1/SQ-2/SQ-3 ambiguities resolved before a deterministic assertion can be written (you cannot assert "name or initials" — you need to know which, and from what source). None of the three blocks test-design entirely; they need tightening, not replacement.

---

## Refined Acceptance Criteria

### Existing Scenarios — Refinements

> Each existing scenario is shown as **Before** (verbatim from Jira `customfield_10063`) → **After** (refined wording) with a one-line rationale. These are refinements of approved scenarios, not inferences — none carry the **NEEDS PO/DEV CONFIRMATION** flag (the flag belongs to genuinely new, inferred scenarios only — see below). Where the refinement still depends on a PO answer to resolve an ambiguity (SQ-1/SQ-2/SQ-3/SQ-4), that dependency is named inline so the refinement can be finalized the moment PO answers.

#### Scenario 1 — Signed-in identity is visible from any screen

**Before:**
```gherkin
Scenario: Signed-in identity is visible from any screen
  Given Elena is signed in and viewing the projects list
   When she looks at the global chrome
   Then she sees an account affordance showing her name or initials
    And opening it reveals her email and her role in the active workspace
       (for example "elena@bunkai.io — Admin")
```

**After** (tightens SQ-1/SQ-2/SQ-3 — language sharpened to be deterministically assertable; the bracketed choices resolve to a single value once PO answers SQ-1/SQ-3):

```gherkin
Scenario: Signed-in identity is visible from any screen
  Given Elena is signed in with email "elena@bunkai.io" and an active membership
        with role "admin" in her active workspace
   When she views any page within the authenticated app shell
        (the persistent account affordance defined for this story —
         page list per Definition of Done, see SQ-2)
   Then she sees an account affordance displaying [her initials derived from
        her email local-part / her display name — per SQ-1 resolution]
    And opening the affordance reveals her exact email "elena@bunkai.io"
        and her role label for the active workspace, displayed as
        [the confirmed label for "admin" — e.g. "Admin", per SQ-3 resolution]
    And no other user's identity or role is ever shown
```

*Rationale*: replaces the ambiguous "name or initials" / "global chrome" / example-only role label with assertable, single-valued statements gated on SQ-1/SQ-2/SQ-3 answers; adds the implicit-but-untested "no other user's identity is shown" guard, which is the kind of assertion a security-conscious persona like Elena would expect and which a misconfigured multi-tenant query could violate.

#### Scenario 2 — Sign out ends the session and returns to sign-in

**Before:**
```gherkin
Scenario: Sign out ends the session and returns to sign-in
  Given Elena has the account menu open
   When she selects "Sign out"
   Then her session ends
    And she lands on the sign-in screen
    And navigating back to a protected screen does not restore the session
```

**After** (tightens SQ-4 — makes "session ends" assertable at the server layer, not just via client navigation):

```gherkin
Scenario: Sign out ends the session and returns to sign-in
  Given Elena has the account menu open
   When she selects "Sign out"
   Then the Supabase session is invalidated server-side (the next request
        carrying the prior session cookie to a protected route is rejected
        by the auth check and redirected to sign-in)
    And she lands on the sign-in screen
    And navigating back to a protected screen — via browser back button
        or by entering the URL directly — does not restore the session
        and redirects to sign-in
```

*Rationale*: the original scenario is already strong and concrete; the only sharpening needed is making explicit that "session ends" means *server-side* invalidation (testable via a re-played-cookie check), not merely "the UI looks signed out" — directly resolves SQ-4 and aligns the AC with the parent story's "safely end my session on a **shared machine**" framing, where a client-only sign-out would be a real security gap.

#### Scenario 3 — Account menu is keyboard accessible and dismissible

**Before:**
```gherkin
Scenario: Account menu is keyboard accessible and dismissible
  Given Elena has focused the account affordance
   When she opens the menu with the keyboard and presses Escape
   Then the menu closes
    And focus returns to the account affordance
```

**After** — **no change needed; testable as-is.** This scenario is already concrete, scoped to a single clear interaction (open → Escape → focus-return), and uses Given/When/Then precisely. It does not need refinement; what it leaves uncovered (Tab-trap, arrow-key nav, ARIA semantics — SQ-5) is real, but those are *additional* a11y dimensions, not flaws *in* this scenario's own wording. They are captured as new scenarios below rather than bolted onto this one, to keep it focused and testable as a single unit.

---

### New Scenarios — Gaps Filled

> Each scenario below fills a gap the Story Quality Analysis identified as real and untested by the 3 existing scenarios. Every one is an INFERENCE (not an extension of an approved scenario) and is flagged **NEEDS PO/DEV CONFIRMATION** verbatim, per the hard requirement. Gherkin style/voice matches the existing 3 for consistency (Elena as actor, present-tense Given/When/Then, concrete example values).

#### New Scenario A — Role display reflects the active workspace, including on switch

```gherkin
Scenario: Role display updates when Elena switches her active workspace
  Given Elena belongs to two workspaces — "upex-team" (role "admin")
        and "qa-guild" (role "viewer") — with "upex-team" currently active
   When she switches her active workspace to "qa-guild" via the workspace switcher
   Then the account affordance now shows her role as "viewer" for "qa-guild"
    And it no longer shows "admin" for "upex-team"
```
**NEEDS PO/DEV CONFIRMATION** — Scenario 1 exemplifies role display with a single static value ("Admin") for the active workspace; it says nothing about whether the displayed role updates live on workspace switch. Given the persona's stated motivation ("confirm I'm in the right account before doing work"), a stale role badge after switching workspaces would be a direct contradiction of the story's purpose — but this scenario is QA's inference of intended behavior, not a stated requirement, and needs PO confirmation that workspace-switch is in scope for this story (vs. a follow-up).

#### New Scenario B — Identity/role surface for a user with no active workspace

```gherkin
Scenario: Account affordance handles a user with no workspace membership
  Given Elena has just signed in for the first time and has no workspace
        memberships yet (no active workspace resolved)
   When she opens the account affordance
   Then her email is still shown
    And the role section shows an explicit empty-state ("No workspace yet"
        or equivalent) rather than a blank, "undefined", or broken value
```
**NEEDS PO/DEV CONFIRMATION** — neither existing scenario states what the affordance shows when `active_workspace_id` is null (a real, reachable state per `/api/v1/me`'s own response shape — e.g., immediately post-signup, before onboarding). This scenario proposes QA's best-guess default; it needs PO confirmation both on the exact empty-state copy and on whether the affordance is even reachable pre-onboarding (if "global chrome" excludes the onboarding route per SQ-2, this scenario may not apply there).

#### New Scenario C — Sign-out failure is surfaced, not silent

```gherkin
Scenario: Sign-out failure is surfaced and the session is preserved
  Given Elena selects "Sign out" while the network is unavailable
        or the auth provider returns an error
   When the sign-out request fails
   Then she sees a clear error message telling her the sign-out did not complete
    And she remains signed in with her session intact
    And no partial sign-out state (half-redirected, half-authenticated) occurs
```
**NEEDS PO/DEV CONFIRMATION** — none of the 3 existing scenarios mention a failure path; Scenario 2 only covers the happy path. `AuthProvider.signOut()` already returns `{ error }` from `supabase.auth.signOut()`, so a failure path is technically reachable, but the story is silent on what Elena should see when it happens. This scenario names QA's expected behavior (visible error, no silent failure, no partial state); exact copy/presentation (toast vs inline) is a Dev/Design decision to confirm.

#### New Scenario D — Sign-out terminates the session across other open tabs

```gherkin
Scenario: Signing out in one tab ends the session everywhere
  Given Elena is signed in to the same account in two browser tabs
   When she signs out from the account menu in the first tab
   Then the second tab also detects the session has ended
        (via the existing auth-state subscription)
    And attempting any action in the second tab redirects her to sign-in
```
**NEEDS PO/DEV CONFIRMATION** — this scenario is the most direct test of the parent user story's explicit "shared machine" framing: a sign-out that only affects the active tab leaves a live session in any other open tab on the same shared machine, which is precisely the risk Elena is described as trying to avoid. None of the 3 existing scenarios test multi-tab/multi-surface propagation. `AuthProvider` already subscribes to `onAuthStateChange`, which suggests the underlying mechanism may exist — but whether it is *relied upon* for this guarantee, and whether it's considered in-scope for THIS story versus a hardening follow-up, needs explicit PO/Dev confirmation.

---

## Edge Cases Identified

| # | Edge case | Criticality |
|---|---|---|
| EC-1 | Account affordance label when "name or initials" source is ambiguous (SQ-1) — e.g. an email with no clean local-part to derive initials from (`+`-aliased addresses, numeric-only local-parts) | Medium |
| EC-2 | Role badge race: Elena switches workspace and the role section briefly shows the *previous* workspace's role before refreshing (a security-relevant flicker for a persona explicitly verifying "am I in the right account") | High |
| EC-3 | `workspace_members.status` flips to `suspended` mid-session (admin-initiated, per the WorkspaceMember state machine) — does the displayed role freeze stale, update, or force a sign-out? | Medium |
| EC-4 | Rapid double-trigger of "Sign out" (double-click/tap) — duplicate `signOut()` calls, duplicate redirects, or a clean no-op on the second call? | Low |
| EC-5 | Opening the account menu, then opening a second overlay (e.g. `CommandPalette`, `WorkspaceSwitcher`) — do the two compete for focus, or does opening one correctly close the other (relevant to Scenario 3's focus-management guarantee)? | Medium |
| EC-6 | Tab-order while the account menu is open — can keyboard focus escape into background page content (focus-trap gap), contradicting the spirit of Scenario 3's accessibility intent even though it only literally tests Escape? | Medium |
| EC-7 | Screen-reader announcement of the account affordance and open menu (accessible name, `aria-expanded`/`aria-haspopup`/`role="menu"`) — Scenario 3 tests sighted-keyboard interaction only, not assistive-tech semantics | Medium |

---

## Clarified Business Rules

- **BR-1** (existing system rule, cited): Role values are exactly `viewer | member | admin | owner` (lowercase), per `workspace_members.role` / `domain-glossary.md` §MemberRole. Any display label is a presentation transform of these canonical values (see SQ-3).
- **BR-2** (existing system rule, cited): "Active workspace" = `active_workspace_id`, resolved by `/api/v1/me` via the `bk_active_ws` cookie with fallback to the oldest membership (`app/api/v1/me/route.ts`). Scenario 1's "role in the active workspace" must track this exact resolution — not any arbitrary or first-listed workspace.
- **BR-3** (inference — **NEEDS PO/DEV CONFIRMATION**): Sign-out is a session-layer action available to every `workspace_members.role` and `status` value — i.e., NOT gated by RBAC the way data mutations are. `AuthProvider.signOut()` calls `supabase.auth.signOut()` directly with no role check, supporting this inference, but it is not stated in any of the 3 scenarios and should be confirmed as an explicit design decision (a regression class — accidental RBAC coupling on a session action — this RLS-heavy multi-tenant app is structurally prone to).
- **BR-4** (inference — **NEEDS PO/DEV CONFIRMATION**): Successful sign-out (Scenario 2's "session ends") implies server-side session/cookie invalidation, not merely a client-side state reset and redirect — directly tied to refinement SQ-4 and the "shared machine" framing in the parent user story.

---

## Open Questions for PO / Dev

> Genuine gaps only — each materially affects scope or test design and cannot be answered from the 3 existing scenarios, the codebase, or domain docs. Several initially-considered questions were dropped because the scenarios (refined) already resolve them via inline **NEEDS PO/DEV CONFIRMATION** flags — those flags ARE the question, scoped to their specific scenario; restating them here would be padding (anti-pattern L1/L7).

1. **What is the deterministic source for "name or initials" (Scenario 1), given the schema has no name field?** (= SQ-1, surfaced here because it blocks writing even ONE assertable test for the story's most basic identity-display claim — every other open item can be deferred a sprint without blocking test design; this one cannot.)

2. **What is the concrete page list for "global chrome" (Scenario 1) / "anywhere in the app" (parent story), given no persistent shell exists today?** (= SQ-2, surfaced here because it is simultaneously the central feasibility blocker — see Critical Analysis — and the input that determines the size of the AC-6-equivalent "reachable from every page" test outline; without it, "every page" cannot be enumerated into a checklist.)

3. **Does "session ends" (Scenario 2) require server-side invalidation, and is multi-tab/multi-device propagation in scope for this story?** (= SQ-4 + New Scenario D, bundled here because they're the same underlying question — "how far does 'safely end my session on a shared machine' go" — and the answer determines whether ~3 of the new scenarios are this-sprint or next-sprint scope.)

---

## ATP DRAFT — Test Outlines

> Outline names + 1-line precondition only, per shift-left Phase 4 contract (full parametrization deferred to in-sprint Phase 4 superset).

### Identity & Role Display (Scenario 1 + New A/B)

1. **Should display the account affordance with the user's name/initials on the account menu** — Precondition: Elena signed in, viewing any page within the defined global-chrome scope (Scenario 1, pending SQ-1/SQ-2)
2. **Should reveal exact email and active-workspace role label when the affordance is opened** — Precondition: Elena is `admin` of her active workspace `upex-team` (Scenario 1, pending SQ-3)
3. **Should never display another user's identity or role** — Precondition: two distinct authenticated sessions in the same workspace (Scenario 1 refinement — multi-tenant guard)
4. **Should update the displayed role immediately after switching active workspace** — Precondition: Elena belongs to `upex-team` (admin) and `qa-guild` (viewer) (New Scenario A — **NEEDS PO/DEV CONFIRMATION**)
5. **Should show an empty-state placeholder for role when the user has no active workspace** — Precondition: newly signed-in user with zero workspace memberships (New Scenario B — **NEEDS PO/DEV CONFIRMATION**)

### Sign-out Effect (Scenario 2 + New C/D)

6. **Should invalidate the session server-side, redirect to sign-in, and block back-navigation** — Precondition: Elena has the account menu open with a valid session (Scenario 2 refinement)
7. **Should surface a visible error and preserve the session when sign-out fails** — Precondition: network unavailable or auth provider returns an error during sign-out (New Scenario C — **NEEDS PO/DEV CONFIRMATION**)
8. **Should terminate the session in all open tabs when signed out from one** — Precondition: same account open in two tabs, sign-out triggered in tab A (New Scenario D — **NEEDS PO/DEV CONFIRMATION**)
9. **Should not duplicate the sign-out flow on rapid repeated triggers** — Precondition: Elena double-clicks/double-taps "Sign out" (EC-4)

### Account Menu Accessibility (Scenario 3 + EC)

10. **Should open via keyboard, close on Escape, and return focus to the affordance** — Precondition: Elena has focused the account affordance (Scenario 3, as-is — no change needed)
11. **Should trap keyboard focus within the open menu (no escape into background content)** — Precondition: account menu is open via keyboard (EC-6)
12. **Should expose correct ARIA semantics to assistive technology** — Precondition: account menu rendered, tested with screen-reader / accessibility tree inspection (EC-7)

### Coverage Estimate

| Type | Count | Notes |
|---|---|---|
| Positive | 5 | Outlines 1, 2, 6, 10 — happy-path identity/role display, sign-out effect, keyboard open/close; plus 3 (multi-tenant isolation, asserted as a positive "shows only own data" guard) |
| Negative | 2 | Outlines 7, 9 — sign-out failure surfaced, duplicate-trigger guard |
| Boundary | 1 | Outline 5 — no-active-workspace empty state |
| Integration | 4 | Outlines 4, 8, 11, 12 — workspace-switch role refresh, multi-tab session termination, focus-trap, ARIA/assistive-tech semantics |

**Total: 12 outlines** across 3 refined existing scenarios + 4 new inferred scenarios + 7 identified edge cases (some folded into outlines above rather than each spawning a dedicated outline) — markedly leaner than v1's 14-outline estimate built on a from-scratch 10-AC set, because this redo anchors on 3 already-approved scenarios rather than inventing the full surface; the new additions target only the gaps the real scenarios leave open (role-display depth, sign-out failure/multi-tab, deeper a11y), not the whole story space again.

---

_Refinement authored as a corrective redo: the 3 real Gherkin scenarios from `customfield_10063` are the baseline. Refinements of those 3 scenarios carry no inference flag (they sharpen what PO already approved); the 4 net-new scenarios are each flagged **NEEDS PO/DEV CONFIRMATION** inline — grep for that string to find every one._
