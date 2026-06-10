# Comments for BK-86

[View in Jira](https://jira.upexgalaxy.com/browse/BK-86)

---

### Andrés Daniel Cumare Morales - 6/8/2026, 9:18:36 AM

=== Shift-Left Refinement: BK-86 ===

## Summary

The 3 existing Gherkin scenarios in the `acceptance_criteria` field were used as the baseline (not discarded or replaced). Of those:

- ***Scenario 1**** ("Signed-in identity is visible from any screen") and ****Scenario 2*** ("Sign out ends the session and returns to sign-in") were refined in place — tightened wording so they become deterministically assertable (e.g. "name or initials" → a single resolvable source pending PO confirmation; "session ends" → explicit server-side invalidation).
- ***Scenario 3*** ("Account menu is keyboard accessible and dismissible") needed no change — already concrete and testable as written.
- ***4 new scenarios**** were added to fill gaps the original 3 leave open: role display on workspace switch, no-active-workspace empty state, sign-out failure handling, and multi-tab session termination. Each one is explicitly flagged ****NEEDS PO/DEV CONFIRMATION*** in the field — every new scenario is QA's inference, not a stated requirement.

The merged set (7 scenarios total) now lives in the `acceptance*criteria` field. The ATP DRAFT (12 test outlines across 3 functional groups, with a coverage estimate) lives in the `acceptance*test_plan` field.

## Central finding

Re-validating the codebase against the real ACs' own language ("global chrome", "account affordance") found that ***no persistent global chrome exists anywhere in the app — not even partially****. The one shared layout for authenticated routes (`app/(app)/layout.tsx`) renders no header, nav rail, or account control; the closest analogs (`WorkspaceSwitcher`, `CommandPalette`) are page-local, show workspace identity rather than user identity, and lack full keyboard/ARIA semantics. ****This reframes BK-86 from "wire identity/role/sign-out into an existing surface" to "design and build the app's first persistent account-menu primitive, then wire identity/role/sign-out into it"*** — a materially different (and larger) estimation input than the bare user-story line implies.

## Open questions blocking full estimation

1. ***What is the deterministic source for "name or initials" (Scenario 1)?*** The schema has no `display*name`/`full*name`/`avatar_url` — `/api/v1/me` exposes only `email`. This blocks writing even one assertable identity-display test.
2. ***What is the concrete page list for "global chrome" / "anywhere in the app"?*** This is the central feasibility blocker (see finding above) and the input that sizes the "reachable from every page" test outline.
3. ***Does "session ends" require server-side invalidation, and is multi-tab/multi-device propagation in scope for this story?*** Determines whether ~3 of the new scenarios are this-sprint or next-sprint work, and ties directly to the parent story's "shared machine" framing.

Action requested: PO + Dev review the merged scenarios and the 3 open questions above before this moves past Estimation. Local working copy of the full refinement: `.context/PBI/epics/EPIC-BK-85-account-settings/stories/STORY-BK-86-account-view-my-identity-role-and-sign-out/shift-left-refinement.md`

Refined on: 2026-06-08 — QA Shift-Left session

---


_Synced from Jira by sync-jira-issues_
