# BK-9 — Session Context

**Story:** TMS-Module | Create modules with nested sub-modules
**Status:** Ready For QA → In Test (sprint session)
**Session date:** 2026-06-06
**Environment:** staging (https://staging-upexbunkai.vercel.app)

---

## Session Notes

### Pre-session code review findings
1. **UX Bug (HIGH)**: `create-module-form.tsx` line 116-121 — on 201 at depth >= 5, ONLY warning toast fires; success toast is suppressed. User gets no "Module created" confirmation — they see only the deep-nesting warning and might assume creation failed.
2. **Client-side gap (LOW)**: form `isValid` checks `name.trim().length > 0` only (not >= 2). 1-char name submits and gets 422 from server. No client-side min-length gate.
3. **Dev checklist says "depth 4" warning** but code (`DEEP_NESTING_WARNING_THRESHOLD = 5`) and AC both say depth >= 5. Test: confirm no warning at depth 4.
4. **Position collision documented** in comments (`nextPosition` is best-effort, concurrent inserts can collide). Out of scope for MVP per code comment.

### DB State (staging, 2026-06-06)
- 2 active modules in project "Smoke Checkout" (ed871b20-aacb-49bb-b636-88bbd00b5440):
  - "Payments" → path: payments, depth 1
  - "Refunds and Credits" → path: refunds-and-credits, depth 1
- DB constraints: CHECK depth <= 6, CHECK description length <= 500, UNIQUE (project_id, path)
- No unique constraint on name directly — uniqueness enforced via materialized path

### Open Questions (from shift-left, still open)
1. Does POST /api/v1/modules support Idempotency-Key header? → to verify
2. Does module creation write to activity_log? → to verify
3. Does Supabase Realtime broadcast on modules INSERT? → out of scope for this sprint

---

## Evidence
Evidence directory: `./evidence/`
