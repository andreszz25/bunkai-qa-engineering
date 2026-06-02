# As a QA Engineer I want to assemble a Test by chaining ATCs from my workspace so that I can run the validations together when verifying a User Story

**Jira Key:** [BK-27](https://upexgalaxy67.atlassian.net/browse/BK-27)
**Epic:** [BK-24](https://upexgalaxy67.atlassian.net/browse/BK-24) (Tests (chains of ATCs))
**Priority:** Medium
**Story Points:** 1
**Status:** Shift-Left QA

---

## User Story

***Source spec:*** BK-015

## User story

***As a*** QA Engineer (Elena persona)
***I want to*** assemble a Test by chaining a sequence of ATCs from my workspace's library
***So that*** I can execute those chained validations together in one Run when verifying a User Story

## Definition of done

- [ ] Functionality available behind the workspace's role permissions (member and above can create; viewer cannot)
- [ ] New Test appears in the Test list immediately after saving
- [ ] Activity log records who created the Test and when
- [ ] Operation works whether triggered from the UI or from an AI agent / CI client using the same Bunkai surface
- [ ] Acceptance criteria validated end-to-end against staging
- [ ] No P0 / P1 bugs open against this story

---

## Acceptance Criteria

```gherkin
Feature: Assemble a Test by chaining ATCs

  Scenario: Elena assembles a Test from three ATCs
    Given Elena is signed in to her workspace and has three published ATCs in her library
    When she opens the "New Test" form, enters the title "Add to Cart from Empty State", selects the three ATCs in the order she wants them to run, and clicks "Save"
    Then the Test is created and appears in her Test list with the title she entered
    And opening the Test shows the three ATCs in the exact order she selected them
    And the activity log of her workspace records that she created this Test, with a timestamp

  Scenario: Saving a Test without any ATC is blocked
    Given Elena is on the "New Test" form with a title entered but no ATC selected
    When she clicks "Save"
    Then the system blocks the save and shows a clear message "A Test must include at least one ATC"
    And no Test is created in her workspace

  Scenario: Accidentally clicking Save twice does not create duplicates
    Given Elena has filled in the "New Test" form correctly
    When she clicks "Save" and her network is slow, causing her to click "Save" again before the first response
    Then only one Test is created in her workspace
    And Elena sees the new Test exactly once in her Test list, not duplicated

  Scenario: Elena cannot use ATCs from a workspace she does not belong to
    Given Elena belongs to workspace "Acme QA" but not to workspace "Other Co"
    When she attempts (through any client — UI, agent, CI) to create a Test that references an ATC owned by "Other Co"
    Then the system rejects the operation with a message that does not reveal whether the foreign ATC exists
    And no Test is created
```

---

## Business Rules

## Business rules

- A Test always belongs to exactly one workspace, the one its author was active in at the moment of creation. This binding is permanent.
- A Test must contain at least one ATC. There is no such thing as an empty Test.
- The ATCs inside a Test must all come from the same workspace as the Test itself. Cross-workspace ATC references are never allowed.
- The order in which Elena selects the ATCs is the order in which they will run inside the Test. The order is preserved verbatim.
- Two ATCs in the same Test can reference the same ATC twice — the chain is a sequence, not a set. (Useful for "open page → click → verify → click → verify" patterns.)
- Only workspace members with role `member`, `admin`, or `owner` can create Tests. Role `viewer` is read-only by design.
- A Test creation cannot be silently lost. Every successful creation produces an activity-log entry that the workspace owner can audit.
- Repeating the exact same creation request within a short window (because of a retry or a double-click) must produce one Test, not many. The system is responsible for recognizing the retry, not the user.
- The title of a Test is required and free-text, limited to 200 characters. Whitespace-only titles are rejected.

---

## Scope

## In scope

- Elena can create a Test by giving it a title and selecting an ordered chain of ATCs from her workspace's library
- The chain order is preserved exactly as Elena defined it
- Empty chains are blocked with a clear validation message before any Test is created
- The Test belongs to the workspace Elena was active in at the moment of creation
- Same operation reachable from the UI and from any headless client (AI agent, CI) using the Bunkai surface
- Accidental double-submission produces exactly one Test, not duplicates
- Workspace activity log captures every Test creation event (author, timestamp, Test title)
- Permission rules: viewer cannot create; member, admin, and owner can

---

## Workflow

## User flow

1. Elena is signed in to her workspace and navigates to the Tests area.
2. She clicks "New Test". A form opens asking for a title and an ordered selection of ATCs.
3. She types a title that describes what the Test validates, e.g. "Add to Cart from Empty State".
4. She picks ATCs from her workspace's ATC library by searching or browsing. She arranges them in the order she wants them to run during execution.
5. She reviews her chain — the order matters, so she double-checks it.
6. She clicks "Save".
7. The system validates the input. If the chain is empty or the title is missing, the form shows a clear message and stays open. Elena fixes the input and tries again.
8. On successful save, Elena lands on the new Test's detail page (or sees the Test added to the Tests list), and her workspace's activity log shows that she just created this Test.
9. From here, Elena (or anyone else in the workspace with the right role) can later open this Test and start a Run on it — covered by the Manual Runs epic (BK-006).

## Note for the AI-agent and CI-agent path

When an agent (Claude Code, GitHub Copilot, a Playwright CI job) creates a Test using the Bunkai headless surface instead of the UI, the exact same business rules above apply. The agent provides title + ATC chain + a retry-safe identifier; the system applies the same validations and emits the same activity-log entry. There is no parallel "agent-only" Test creation path — one rulebook, three executors.

---

## Traceability

### Story (1)

- [BK-28](https://upexgalaxy67.atlassian.net/browse/BK-28): As a QA Engineer I want to reorder the ATCs inside an existing Test so that I can fix the sequence after seeing it does not match the User Story flow _(Shift-Left QA)_

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
_Last sync: 2026-05-28T08:58:39.100Z_
