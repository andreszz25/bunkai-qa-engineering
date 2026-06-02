# As a QA Engineer I want to reorder the ATCs inside an existing Test so that I can fix the sequence after seeing it does not match the User Story flow

**Jira Key:** [BK-28](https://upexgalaxy67.atlassian.net/browse/BK-28)
**Epic:** [BK-24](https://upexgalaxy67.atlassian.net/browse/BK-24) (Tests (chains of ATCs))
**Priority:** Medium
**Story Points:** 1
**Status:** Shift-Left QA

---

## User Story

***Source spec:*** BK-016

## User story

***As a*** QA Engineer (Elena persona)
***I want to*** reorder the ATCs inside an existing Test
***So that*** I can fix the execution sequence after discovering the original order does not match the User Story flow I am verifying

## Definition of done

- [ ] Functionality available behind the workspace's role permissions (member and above can reorder; viewer cannot)
- [ ] New order is visible immediately after saving and persists across page reloads
- [ ] Activity log records who reordered the Test, when, and what the new chain looks like
- [ ] The same reorder operation works whether triggered from the UI or from an AI agent / CI client using the Bunkai surface
- [ ] Acceptance criteria validated end-to-end against staging
- [ ] No P0 / P1 bugs open against this story

---

## Acceptance Criteria

```gherkin
Feature: Reorder the ATCs inside an existing Test

  Scenario: Elena drags an ATC into a new position and saves
    Given Elena has an existing Test "Add to Cart from Empty State" containing four ATCs in the order A, B, C, D
    When she opens the Test, drags ATC D to the second position so the chain becomes A, D, B, C, and clicks "Save"
    Then the Test is updated and the chain is now A, D, B, C
    And when she or any teammate reopens the Test, the chain still shows A, D, B, C
    And the activity log of her workspace records that Elena reordered this Test, with a timestamp and the new chain

  Scenario: Saving without changing the order is a no-op
    Given Elena has an existing Test containing ATCs A, B, C in that order
    When she opens the Test, drags an ATC and drops it back in its original slot, then clicks "Save"
    Then the system recognizes there is no change and does NOT record a new reorder entry in the activity log
    And the Test's last-modified timestamp does not change

  Scenario: A viewer cannot reorder a Test
    Given Pablo is signed in to the same workspace as Elena but with role "viewer"
    When he opens the same Test
    Then the reorder controls are not available to him (drag handles are absent or visibly disabled)
    And any attempt to invoke the reorder action through any other client is rejected with a clear permission message

  Scenario: Two teammates reorder the same Test at the same time
    Given Elena and her teammate Mateo are both viewing Test "Add to Cart from Empty State" at the same moment, both seeing the chain A, B, C
    And Mateo reorders the chain to C, B, A and saves first
    When Elena now tries to save her own reorder to B, A, C, which was based on the stale A, B, C view
    Then the system blocks Elena's save and shows a clear message that the Test was changed by someone else, with the current order C, B, A
    And Elena can review the new chain and decide whether to start over or keep Mateo's version
```

---

## Business Rules

## Business rules

- Reorder preserves the set of ATCs exactly. Adding or removing an ATC is a different operation and is out of scope of this story.
- The new chain order Elena defines is the order in which the ATCs will run during execution. The order is preserved verbatim.
- Two ATCs in the same Test can reference the same ATC; reordering moves the references, not the underlying ATC.
- Only workspace members with role `member`, `admin`, or `owner` can reorder a Test. Role `viewer` is read-only.
- A reorder that produces the same final order as before is not a "real" change — it must NOT pollute the activity log or bump the Test's last-modified timestamp. The user does not pay a cost for double-checking.
- A real reorder must produce exactly one activity-log entry, even if the user submits the same reorder twice in rapid succession (retry-safe).
- When two teammates reorder the same Test concurrently, the second save is blocked with a clear message — it never silently overwrites. The user always sees the current state before deciding.
- Reorder inherits the Test's workspace boundary — no cross-workspace reorder is possible because no cross-workspace Test is reachable in the first place.

---

## Scope

## In scope

- Elena can reorder the ATCs inside an existing Test she has access to, preserving the set of ATCs (no add, no remove)
- The new order persists across reloads and across sessions
- The same reorder operation is reachable from the UI and from any headless client (AI agent, CI) using the Bunkai surface
- A no-op reorder (saving the same order back) does NOT create an activity log entry and does NOT bump the Test's last-modified timestamp
- Activity log captures every real reorder event: author, timestamp, and the new chain after the reorder
- Permission rules: only member, admin, and owner can reorder; viewer cannot, and the affordance is hidden from them
- Concurrent-edit safety: if a teammate reordered the same Test in between, Elena's stale save is blocked with a clear message instead of silently overwriting

---

## Workflow

## User flow

1. Elena opens a Test she previously created (or one a teammate created in her workspace).
2. The Test detail view shows the current ATC chain in order, with drag handles next to each ATC (visible only if Elena has reorder permission).
3. Elena drags an ATC up or down to a new position. The UI gives immediate visual feedback as she drops.
4. She continues reordering until the sequence matches the User Story flow she is verifying.
5. She clicks "Save".
6. The system checks for conflicts — has anyone else reordered this same Test since Elena opened it?

   - If yes: the save is blocked with a message showing the current order; Elena reviews and decides whether to keep her change or accept the teammate's.
   - If no: the new order is committed.

1. If the order Elena submitted is identical to what was there before, the system saves no change — no activity log entry, no last-modified bump.
2. If the order actually changed, the activity log of her workspace shows the new chain alongside her name and a timestamp.
3. From here, anyone who opens the Test later will see the updated chain, and any subsequent Run will execute the ATCs in the new order — covered by the Manual Runs epic (BK-006).

## Note for the AI-agent and CI-agent path

When an agent reorders a Test through the Bunkai headless surface instead of the UI, the same business rules apply: same permission gate, same no-op detection, same concurrent-edit guard, same activity-log entry. The agent provides the Test identifier + the new chain order + a retry-safe identifier. There is no "agent-only" reorder path.

---

## Traceability

### Story (1)

- [BK-27](https://upexgalaxy67.atlassian.net/browse/BK-27): As a QA Engineer I want to assemble a Test by chaining ATCs from my workspace so that I can run the validations together when verifying a User Story _(Shift-Left QA)_

---

## Definition of Done

- [ ] Implementation complete
- [ ] Unit tests written
- [ ] Code reviewed
- [ ] Documentation updated

---

## Metadata

- **Created:** 5/27/2026
- **Updated:** 5/27/2026
- **Reporter:** Ely
- **Assignee:** Unassigned
- **Labels:** master-sprint-4, mvp, tests-epic

---

_Synced from Jira by sync-jira-issues_
_Last sync: 2026-05-28T08:58:39.102Z_
