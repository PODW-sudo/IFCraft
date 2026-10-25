# Step document template

Copy this structure for any new step. Keep it terse — a step document is a work order, not an essay.

---

```markdown
# STEP-NN — <short imperative title>

**Status:** not started · **Wave:** A | B | C | D · **Effort:** <n> d
**Findings:** F-NNN, F-NNN · **Depends on:** STEP-NN · **Blocks:** STEP-NN

## Problem

<2–4 sentences. What does the user experience? What breaks? Why does it matter?
Prefer a measured number ("an 8-second freeze on opening a 49 MB model") over an adjective.>

## Evidence

- `backend/app/services/ai_service.py:828-868` — <what is wrong, precisely>
- Measured: <command> → <output>

## Scope

**Change:**
- `path/to/file.ts:120-140` — <what changes>

**Do not change:**
- <files/behaviours explicitly out of scope, to stop scope creep>

**Non-goals:**
- <the tempting larger thing this step deliberately does not do>

## Spec

<Numbered functional requirements. Each must be independently testable.
Write them so a test can assert them directly.>

1. <requirement>
2. <requirement>

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_stepNN_<slug>.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_stepNN_<slug>.py -v`

<details>
<complete test code>
</details>

### 2. Watch it fail

```
<expected failure message>
```

### 3. Implement

<What to change, in order. Point at the exact functions.>

### 4. Watch it pass

```
<expected output>
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

## Acceptance criteria

- [ ] <measurable, verifiable condition>
- [ ] <measurable, verifiable condition>

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| <risk> | <mitigation> | <how to revert> |

## Notes

<Anything the next implementer needs that does not fit above.>
```

---

## Rules for writing step documents

1. **Every requirement must be assertable.** If you cannot write a test for it, it is not a
   requirement — it is a wish.
2. **Cite `file:line`.** The executor should not have to search for the code.
3. **Name the failure message you expect.** "Watch it fail" is the step that prevents a
   vacuous test from being written.
4. **Give a regression guard command.** Every step must say what stays green.
5. **State non-goals explicitly.** Most scope creep in this codebase comes from a step
   adjacent to a bigger one.
6. **Prefer a measurement to a description.** "8.2 s" beats "slow".
