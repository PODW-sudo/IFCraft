# IFC Editor — Audit Package (2026-10-24)

This folder is the complete hand-off from the 2026-10-24 audit of the IFC Editor.
It contains the findings, the verification evidence, and a sequenced implementation
plan with TDD specifications that an executor (human or agent) can pick up one step at a time.

**Status (2026-10-25): implemented.** All 28 steps across Waves A–D were executed in one pass.
The package is now the specification + evidence trail; per-step outcomes are recorded in
`steps/STATUS.md`, each step document's `## Notes`, and `steps/notes/STEP-*.md`.

---

## Contents

| File | What it is |
|---|---|
| [`FINDINGS.md`](FINDINGS.md) | The findings register — 66 findings, IDs `F-001`…`F-066`, severity-ranked, each with code references and a verification marker |
| [`VERIFICATION.md`](VERIFICATION.md) | Every command that was run and its measured output, plus what was *not* verified |
| [`USER-NEEDS.md`](USER-NEEDS.md) | Gap analysis against what architects and BIM engineers actually need |
| [`ROADMAP.md`](ROADMAP.md) | The sequenced plan: waves, dependency graph, definition of done, what not to build |
| [`TEMPLATE.md`](TEMPLATE.md) | The canonical shape of a step document — use it for any new step |
| [`steps/`](steps/) | 28 step specifications, each with scope, spec, TDD test and acceptance criteria |
| [`tests/`](tests/) | Ready-to-run test files for the steps that can be automated today |

---

## How an executor should use this

> **Scope decision (2026-10-25): all waves executed.** Steps 01–29 are implemented and their
> tests are wired into the default suites. See `steps/STATUS.md` for the outcome of each step.

### 1. Read the wave you are assigned

`ROADMAP.md` divides the work into four waves. Each step lists its **depends on** and **blocks**
fields. Do not start a step whose dependencies are unmet.

```
Wave A  Ship-blocking correctness        STEP-01, 02, 03, 04, 05, 06, 07, 29   <-- AUTHORISED
Wave B  Feature correctness at real scale STEP-08 … STEP-15                    parked
Wave C  Hardening and consistency         STEP-16 … STEP-24                    parked
Wave D  Hygiene, infrastructure, ergonomics STEP-25 … STEP-28                  parked
```

### 2. Follow the TDD loop inside each step

Every step document contains a **`## TDD`** section with:

1. **The test to add** — exact file path, exact test name, complete runnable code.
2. **How to watch it fail** — the command and the expected failure message.
3. **The implementation contract** — precisely what behaviour must change.
4. **How to watch it pass** — the command and the expected output.
5. **Regression guard** — the existing tests that must stay green.

The loop is always: **add the failing test → run it → confirm it fails for the stated reason →
implement → run it → confirm green → run the regression guard → commit.**

Never implement before the test fails. A test that passes before the fix is not testing the fix.

### 3. Copy the test file in

Test files for the automatable steps live in [`tests/`](tests/). They are **not** wired into the
default `pytest` / `vitest` runs, so the repo's CI stays green while the plan is in flight.

When you start a step:

```powershell
# backend step
Copy-Item docs/audit-2026-10/tests/backend/test_step06_clash_correctness.py backend/tests/

# frontend step
Copy-Item docs/audit-2026-10/tests/frontend/step11.omnibarCtrlK.test.ts frontend/src/tests/
```

Then run the command named in the step's TDD section.

### 4. Record the outcome

When a step is complete, append an entry to `DEVELOPMENT_HANDOFF.md` using the format in
`AGENTS.md` §B8, **and** add a line to `steps/STATUS.md` (created on first completion):

```
| STEP-06 | done | 2026-10-31 | F-005 | PR #1234 |
```

`DEVELOPMENT_HANDOFF.md` currently has an empty *Open Items* section — see F-054. Restoring it is
part of the plan (STEP-26).

---

## Conventions used throughout

- **Paths** are repository-relative. `backend/app/services/ifc_service.py:257` means that file, line 257.
- **Finding IDs** (`F-001`) are stable. Steps reference them; do not renumber.
- **Severity**: `P0` ship-blocking · `P1` blocks real work · `P2` correctness/trust · `P3` quality/hygiene.
- **Verification markers** in `FINDINGS.md`: `[V]` reproduced by the auditor · `[L]` found by a
  specialist lane by reading code · `[R]` repo/doc observation.
- **Wave A steps are backend-only** and can be executed in parallel by different people *except*
  where a dependency is listed. `STEP-01`, `STEP-03`, `STEP-04`, `STEP-05`, `STEP-06` and
  `STEP-07` touch disjoint files and can run concurrently.

---

## The short version

The macro-architecture is sound: clean service layering, correct worker isolation, a real
undo model for CAD, deterministic quality gates, CI wired to pytest.

The problem is depth. Fourteen "phases" shipped in three weeks. The features look finished;
the data path underneath them does not survive a real customer file.

The three things that matter most, in order:

1. **F-001** — the AI copilot's "move element 2 m" moves it 2 km on any millimetre-unit model
   (13.5 km on a *zero* delta). Proven by reproduction.
2. **F-066** — editing a property value in the Property Inspector can never succeed: the request
   uses `PATCH` on a `POST`-only route and the wrong field name, and the error is swallowed. A
   headline README feature is a silent no-op.
3. **F-002 + F-004** — every drag rewrites the whole model file twice, concurrently and
   non-atomically, on an event loop that stalls the entire backend for 8 seconds when a
   large model is opened.
4. **F-005** — clash detection never examines a single wall, yet reports a confident
   "110 clashes". A BIM engineer reads that as a coordination result.

Everything else in this package is either a smaller version of the same three themes
(reports success it did not achieve; nothing is reversible; everything is anonymous) or
housekeeping (F-053…F-065).

---

## One caution for the executor

Three findings are **not** what they look like at first glance. Read their step documents before acting:

- **F-011** (red master) is not "the test is wrong". `git blame` shows a *UI* commit silently
  changed BIM generation logic. Decide which behaviour is correct **with the product owner**,
  then change code or test to match — do not simply relax the assertion.
- **F-002** (double write) looks like a trivial "delete 6 lines". It is not: one of the two paths
  carries the soft-lock check and the audit row. Removing the wrong one breaks collaboration.
- **F-006** (batched visibility) looks like "call `setVisibleAt`". It is not: the batch path keeps
  no per-instance id map, and the picking path also needs to stay consistent with the new
  visibility model or hidden elements become unselectable-but-visible.
