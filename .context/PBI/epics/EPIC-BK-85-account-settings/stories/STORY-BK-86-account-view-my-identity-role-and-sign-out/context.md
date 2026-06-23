# BK-86 — Session Context

## Session Notes

- **Session started**: 2026-06-23
- **Mode**: Single-ticket, User Story
- **Environment**: staging (`https://staging-upexbunkai.vercel.app`)
- **TMS Modality**: jira-xray (`bun xray`)

## Shift-Left Status

Story passed through `/shift-left-testing` on 2026-06-08 (label `shift-left-reviewed`).
All 3 open questions resolved by PO/Dev/Design in comments. All 4 new scenarios confirmed in scope.
ATP DRAFT has 12 test outlines across 3 groups — ready for in-sprint parametrization.

## Key Decisions from Shift-Left

- **SQ-1 (initials source)**: derive from email local-part, no `display_name` field in this story
- **SQ-2 (global chrome scope)**: every authenticated route under `(app)` layout, including `/onboarding`
- **SQ-3 (role label)**: capitalize canonical enum value (`admin` → "Admin")
- **SQ-4 (session end)**: server-side invalidation in scope
- **New Scenario A**: role updates on workspace switch — in scope
- **New Scenario B**: no-workspace empty state — in scope
- **New Scenario C**: sign-out failure surfaced — in scope
- **New Scenario D**: multi-tab termination — in scope

## API Context

- `/api/v1/me` returns `{ user: { id, email }, workspaces[], active_workspace_id }`
- Role field was MISSING at shift-left time — needs verification that PR added it
- Sign-out via `AuthProvider.signOut()` → `supabase.auth.signOut()`

## Open Questions

(none — all shift-left questions resolved by PO/Dev/Design)
