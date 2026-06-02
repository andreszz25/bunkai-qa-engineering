# BK-3 — Sign up and sign in via OAuth (GitHub / Google)

**Status**: Shift-Left QA
**Parent Epic**: BK-1 (Tenancy & Identity)
**Source Spec**: FR-001 — Email & OAuth sign-up (OAuth portion)
**Labels**: auth, mvp, wave-1, shift-left-reviewed, shift-left-2026-05-26
**Risk Level**: HIGH

---

## Summary

Enable GitHub and Google OAuth sign-in/sign-up flows in the Bunkai TMS login screen. Includes CSRF state-token validation, auto-creation of a default workspace on first verified OAuth login, and magic-link fallback when OAuth callback fails within 30s.

---

## Acceptance Criteria (Original — 5 Scenarios)

1. GitHub OAuth happy path — user upserted, lands on Workspace Home, default workspace created
2. Google OAuth happy path — user signed in/up, lands on Workspace Home
3. OAuth consent denied → redirect `/login` with `OAUTH_DENIED` + "Try a different method" CTA
4. OAuth state CSRF token mismatch → 403, error code `OAUTH_STATE_MISMATCH`, no session created
5. Third-party cookie restrictions → magic-link fallback surfaced within 30s with explanatory copy

---

## Open Questions (to resolve in sprint planning)

See `shift-left-refinement.md` — Section: Open Questions for PO / Dev

---

## Session Notes

- Shift-left refinement written: 2026-05-26
- Codebase status: OAuth buttons are disabled in UI (`cursor-not-allowed opacity-60`), no OAuth client implementation exists, callback route handles magic-link only
- All 3 implementation layers (UI buttons, client OAuth initiation, server callback) must be built from scratch
